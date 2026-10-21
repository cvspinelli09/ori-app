BEGIN;

-- ETAPA 1C: revisão completa da RPC; executar somente após revisão e autorização.
-- Pré-requisito: public.catalogo_familias_produtos com FK UUID/ BIGINT,
-- PK (familia_id, produto_id) e políticas administrativas já instaladas.
-- Não altera produtos nem copia imagens. Assinatura e permissões preservadas.
-- produto_ids ausente: preservar; []: remover; array: substituir exatamente.
-- Strings de inteiros são aceitas para transporte seguro de IDs bigint.

-- Revisão manual obrigatória: este arquivo não é executado pela aplicação.
-- A função recebe UUIDs tipados para Família e Linhas. IDs de páginas são
-- UUIDs opcionais no JSON, pois páginas novas ainda não possuem ID.

create or replace function public.salvar_catalogo_familia(
  p_familia_id uuid,
  p_familia jsonb,
  p_linha_ids uuid[],
  p_paginas jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_familia_id uuid;
  v_nome text;
  v_marca text;
  v_veiculo text;
  v_anos text;
  v_ordem integer;
  v_ativo boolean;
  v_ativo_text text;
  v_linha_ids uuid[] := coalesce(p_linha_ids, array[]::uuid[]);
  v_total_linhas_validas integer;
  v_total_linhas_ativas integer;
  v_total_paginas_ativas integer := 0;
  v_pagina record;
  v_pagina_id uuid;
  v_imagem_url text;
  v_titulo text;
  -- Campo ausente preserva vínculos; array vazio remove todos.
  v_sync_produtos boolean := false;
  v_produto_ids bigint[] := array[]::bigint[];
  v_produto_json jsonb;
  v_produto_text text;
  v_produto_id bigint;
  v_total_produtos bigint;
  v_vinculos_removidos bigint;
  v_vinculos_inseridos bigint;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Somente administradores podem salvar famílias.'
      using errcode = '42501';
  end if;

  if jsonb_typeof(p_familia) is distinct from 'object' then
    raise exception 'Dados da Família inválidos.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_paginas) is distinct from 'array' then
    raise exception 'A lista de páginas é inválida.' using errcode = '22023';
  end if;

  v_sync_produtos := p_familia ? 'produto_ids';
  if v_sync_produtos then
    if jsonb_typeof(p_familia -> 'produto_ids') is distinct from 'array' then
      raise exception 'produto_ids deve ser um array e não pode ser null.'
        using errcode = '22023';
    end if;

    for v_produto_json in
      select value from jsonb_array_elements(p_familia -> 'produto_ids')
    loop
      -- Aceita inteiros JSON e strings decimais para evitar perda de precisão
      -- de bigint em clientes JavaScript. Não aceita frações nem coerções.
      if jsonb_typeof(v_produto_json) not in ('number', 'string') then
        raise exception 'Há um ID de produto inválido.' using errcode = '22023';
      end if;
      v_produto_text := v_produto_json #>> '{}';
      if v_produto_text !~ '^-?[0-9]+$' then
        raise exception 'IDs de produtos devem ser inteiros bigint.'
          using errcode = '22023';
      end if;
      begin
        v_produto_id := v_produto_text::bigint;
      exception
        when numeric_value_out_of_range or invalid_text_representation then
          raise exception 'Há um ID de produto fora do formato ou intervalo bigint.'
            using errcode = '22023';
      end;
      v_produto_ids := array_append(v_produto_ids, v_produto_id);
    end loop;

    if (
      select count(*) <> count(distinct produto_id)
      from unnest(v_produto_ids) as incoming(produto_id)
    ) then
      raise exception 'Um produto foi informado mais de uma vez.'
        using errcode = '22023';
    end if;
  end if;

  v_nome := nullif(btrim(p_familia ->> 'nome'), '');
  v_marca := nullif(btrim(p_familia ->> 'marca'), '');
  v_veiculo := nullif(btrim(p_familia ->> 'veiculo'), '');
  v_anos := nullif(btrim(p_familia ->> 'anos'), '');

  if v_nome is null then
    raise exception 'Informe o nome da Família.' using errcode = '22023';
  end if;

  if v_marca is null then
    raise exception 'Informe a marca.' using errcode = '22023';
  end if;

  if v_veiculo is null then
    raise exception 'Informe o veículo.' using errcode = '22023';
  end if;

  if coalesce(p_familia ->> 'ordem', '') !~ '^-?[0-9]+$' then
    raise exception 'A ordem da Família é inválida.' using errcode = '22023';
  end if;

  v_ordem := (p_familia ->> 'ordem')::integer;

  if v_ordem < 0 then
    raise exception 'A ordem da Família não pode ser negativa.'
      using errcode = '22023';
  end if;

  v_ativo_text := lower(coalesce(p_familia ->> 'ativo', 'true'));

  if v_ativo_text not in ('true', 'false') then
    raise exception 'A situação da Família é inválida.'
      using errcode = '22023';
  end if;

  v_ativo := v_ativo_text::boolean;

  if (
    select count(*) <> count(distinct linha_id)
    from unnest(v_linha_ids) as incoming(linha_id)
  ) then
    raise exception 'Uma Linha foi informada mais de uma vez.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(v_linha_ids) as incoming(linha_id)
    where linha_id is null
  ) then
    raise exception 'A lista de Linhas não pode conter valores nulos.'
      using errcode = '22023';
  end if;

  -- Toda Linha enviada deve existir e nunca pode ser a Linha especial Familias.
  select count(*)
    into v_total_linhas_validas
  from public.catalogo_linhas l
  where l.id = any(v_linha_ids)
    and translate(
      lower(btrim(l.nome)),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    ) <> 'familias';

  if v_total_linhas_validas <> cardinality(v_linha_ids) then
    raise exception
      'As Linhas devem existir e não podem ser a Linha especial Familias.'
      using errcode = '22023';
  end if;

  select count(*)
    into v_total_linhas_ativas
  from public.catalogo_linhas l
  where l.id = any(v_linha_ids)
    and l.ativo is true
    and translate(
      lower(btrim(l.nome)),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    ) <> 'familias';

  if v_ativo and cardinality(v_linha_ids) = 0 then
    raise exception 'Uma Família ativa precisa de ao menos uma Linha ativa.'
      using errcode = '22023';
  end if;

  if v_ativo and v_total_linhas_ativas <> cardinality(v_linha_ids) then
    raise exception 'Uma Família ativa só pode usar Linhas ativas.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from (
      select nullif(btrim(value ->> 'id'), '')::uuid as id
      from jsonb_array_elements(p_paginas)
    ) pages
    where id is not null
    group by id
    having count(*) > 1
  ) then
    raise exception 'Uma página existente foi informada mais de uma vez.'
      using errcode = '22023';
  end if;

  -- Valida todas as páginas antes de escrever qualquer registro.
  for v_pagina in
    select value as payload, ordinality - 1 as ordem
    from jsonb_array_elements(p_paginas) with ordinality
  loop
    if jsonb_typeof(v_pagina.payload) <> 'object' then
      raise exception 'Há uma página inválida.' using errcode = '22023';
    end if;

    v_imagem_url := nullif(btrim(v_pagina.payload ->> 'imagem_url'), '');

    if v_imagem_url is null then
      raise exception 'Todas as páginas enviadas precisam de uma URL de imagem.'
        using errcode = '22023';
    end if;

    v_ativo_text := lower(coalesce(v_pagina.payload ->> 'ativo', 'true'));

    if v_ativo_text not in ('true', 'false') then
      raise exception 'A situação de uma página é inválida.'
        using errcode = '22023';
    end if;

    if v_ativo_text::boolean then
      v_total_paginas_ativas := v_total_paginas_ativas + 1;
    end if;
  end loop;

  if v_ativo and v_total_paginas_ativas = 0 then
    raise exception
      'Uma Família ativa precisa de ao menos uma página ativa com imagem.'
      using errcode = '22023';
  end if;

  if v_ativo and not exists (
    select 1
    from jsonb_array_elements(p_paginas) with ordinality capa(payload, ordinality)
    where capa.ordinality = 1
      and nullif(btrim(capa.payload ->> 'imagem_url'), '') is not null
      and lower(coalesce(capa.payload ->> 'ativo', 'true')) = 'true'
  ) then
    raise exception
      'A capa de uma Família ativa deve ser a primeira página, estar ativa e ter uma URL de imagem válida.'
      using errcode = '22023';
  end if;

  if p_familia_id is null then
    insert into public.catalogo_familias (
      nome, marca, veiculo, anos, ordem, ativo, updated_at
    )
    values (
      v_nome, v_marca, v_veiculo, v_anos, v_ordem, v_ativo, now()
    )
    returning id into v_familia_id;
  else
    select id
      into v_familia_id
    from public.catalogo_familias
    where id = p_familia_id
    for update;

    if not found then
      raise exception 'Família não encontrada.' using errcode = '22023';
    end if;

    update public.catalogo_familias f
       set nome = v_nome,
           marca = v_marca,
           veiculo = v_veiculo,
           anos = v_anos,
           ordem = v_ordem,
           ativo = v_ativo,
           updated_at = now()
     where f.id = v_familia_id
       and (
         f.nome,
         f.marca,
         f.veiculo,
         f.anos,
         f.ordem,
         f.ativo
       ) is distinct from (
         v_nome,
         v_marca,
         v_veiculo,
         v_anos,
         v_ordem,
         v_ativo
       );
  end if;

  -- Rejeita IDs de páginas de outra Família. Em cadastro novo, nenhum ID é aceito.
  for v_pagina in
    select value as payload
    from jsonb_array_elements(p_paginas)
  loop
    if nullif(btrim(v_pagina.payload ->> 'id'), '') is not null then
      if p_familia_id is null then
        raise exception 'Uma Família nova não pode receber IDs de páginas existentes.'
          using errcode = '22023';
      end if;

      v_pagina_id := nullif(btrim(v_pagina.payload ->> 'id'), '')::uuid;

      perform 1
      from public.catalogo_familias_paginas p
      where p.id = v_pagina_id
        and p.familia_id = v_familia_id;

      if not found then
        raise exception 'Página inválida para esta Família.' using errcode = '22023';
      end if;
    end if;
  end loop;

  if v_sync_produtos then
    -- A Família já foi criada ou bloqueada por FOR UPDATE acima.
    -- FOR SHARE impede exclusão ou mudança de ativo durante a validação
    -- e sincronização. Ordem estável reduz o risco de deadlocks.
    perform p.id
    from public.produtos p
    where p.id = any(v_produto_ids)
    order by p.id
    for share of p;
    get diagnostics v_total_produtos = row_count;

    if v_total_produtos <> cardinality(v_produto_ids) then
      raise exception 'Um ou mais produtos informados não existem.'
        using errcode = '22023';
    end if;

    if exists (
      select 1
      from public.produtos p
      where p.id = any(v_produto_ids)
        and p.ativo is not true
        and not exists (
          select 1
          from public.catalogo_familias_produtos fp
          where fp.familia_id = v_familia_id
            and fp.produto_id = p.id
        )
    ) then
      raise exception 'Novos vínculos só podem usar produtos ativos.'
        using errcode = '22023';
    end if;

    delete from public.catalogo_familias_produtos fp
    where fp.familia_id = v_familia_id
      and not (fp.produto_id = any(v_produto_ids));
    get diagnostics v_vinculos_removidos = row_count;

    insert into public.catalogo_familias_produtos (familia_id, produto_id)
    select v_familia_id, incoming.produto_id
    from unnest(v_produto_ids) as incoming(produto_id)
    where not exists (
      select 1
      from public.catalogo_familias_produtos fp
      where fp.familia_id = v_familia_id
        and fp.produto_id = incoming.produto_id
    );
    get diagnostics v_vinculos_inseridos = row_count;

    if v_vinculos_removidos > 0 or v_vinculos_inseridos > 0 then
      update public.catalogo_familias
      set updated_at = now()
      where id = v_familia_id;
    end if;
  end if;

  -- Remove somente vínculos que não foram enviados.
  delete from public.catalogo_familias_linhas fl
   where fl.familia_id = v_familia_id
     and not (fl.linha_id = any(v_linha_ids));

  -- Insere somente vínculos que ainda não existem.
  insert into public.catalogo_familias_linhas (familia_id, linha_id)
  select v_familia_id, l.id
  from public.catalogo_linhas l
  where l.id = any(v_linha_ids)
    and not exists (
      select 1
      from public.catalogo_familias_linhas fl
      where fl.familia_id = v_familia_id
        and fl.linha_id = l.id
    );

  -- Remove somente páginas que foram retiradas do formulário.
  delete from public.catalogo_familias_paginas p
   where p.familia_id = v_familia_id
     and not exists (
       select 1
       from jsonb_array_elements(p_paginas) submitted(payload)
       where nullif(btrim(submitted.payload ->> 'id'), '')::uuid = p.id
     );

  /*
   * A posição no array determina a ordem. Portanto, a primeira página
   * é sempre a capa (ordem = 0), sem deslocamentos temporários.
   */
  for v_pagina in
    select value as payload, ordinality - 1 as ordem
    from jsonb_array_elements(p_paginas) with ordinality
  loop
    v_imagem_url := nullif(btrim(v_pagina.payload ->> 'imagem_url'), '');
    v_titulo := nullif(btrim(v_pagina.payload ->> 'titulo'), '');
    v_ativo := lower(coalesce(v_pagina.payload ->> 'ativo', 'true'))::boolean;

    if nullif(btrim(v_pagina.payload ->> 'id'), '') is null then
      insert into public.catalogo_familias_paginas (
        familia_id, imagem_url, titulo, ordem, ativo, updated_at
      )
      values (
        v_familia_id,
        v_imagem_url,
        v_titulo,
        v_pagina.ordem::integer,
        v_ativo,
        now()
      );
    else
      v_pagina_id := nullif(btrim(v_pagina.payload ->> 'id'), '')::uuid;

      update public.catalogo_familias_paginas p
         set imagem_url = v_imagem_url,
             titulo = v_titulo,
             ordem = v_pagina.ordem::integer,
             ativo = v_ativo,
             updated_at = now()
       where p.id = v_pagina_id
         and p.familia_id = v_familia_id
         and (
           p.imagem_url,
           p.titulo,
           p.ordem,
           p.ativo
         ) is distinct from (
           v_imagem_url,
           v_titulo,
           v_pagina.ordem::integer,
           v_ativo
         );
    end if;
  end loop;

  return jsonb_build_object('id', v_familia_id, 'ok', true);
end;
$$;

revoke all on function public.salvar_catalogo_familia(uuid, jsonb, uuid[], jsonb)
  from public, anon;

grant execute on function public.salvar_catalogo_familia(uuid, jsonb, uuid[], jsonb)
  to authenticated;

COMMIT;
