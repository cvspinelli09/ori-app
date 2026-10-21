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
