-- ============================================================
-- PERFIS — campos novos pra suportar 3 perfis (admin/vendedor/cliente) com dados
-- estruturados, e verificação central de "usuário ativo" reutilizável por qualquer
-- recurso autenticado protegido.
-- ============================================================

alter table public.profiles
  add column if not exists telefone text,
  add column if not exists empresa text,
  add column if not exists cidade text,
  add column if not exists uf text,
  add column if not exists regiao text,
  add column if not exists cargo text,
  add column if not exists cnpj text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists updated_by uuid references public.profiles(id);

-- Verificação central: o usuário autenticado corresponde a um perfil com ativo=true.
-- Qualquer policy (atual ou futura) que precise exigir "conta ativa" reusa esta função,
-- em vez de repetir a mesma subquery em cada tabela.
create function public.is_active_user()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and ativo = true
  );
$$;

-- is_admin() passa a exigir role admin E ativo=true simultaneamente. Como todas as
-- policies de admin do projeto (produtos, conteudo_site, leads, vendedor_atividade,
-- profiles) já chamam esta função central (ver 0002_fix_rls_recursion.sql), essa única
-- alteração propaga a exigência de "ativo" pra todas elas de uma vez, sem editar cada
-- policy individualmente.
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin' and ativo = true
  );
$$;

-- profiles: hoje só existe policy de update pro próprio usuário. Sem esta policy nova,
-- nenhum admin conseguiria promover role, editar dados ou desativar o perfil de terceiros
-- (inclusive o próprio Cristian, ao final do período de suporte pós-entrega).
create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- Checagem de segurança encontrada antes desta migration: "profiles_update_own" (0001)
-- só tem USING (auth.uid() = id), sem WITH CHECK — o Postgres autogera o WITH CHECK a
-- partir do USING pra UPDATE, o que só valida QUAL LINHA pode ser tocada, não QUAIS
-- COLUNAS mudam dentro dela. Ou seja: hoje um usuário comum consegue chamar
-- .update({ role: 'admin', ativo: true }) na própria linha e isso passaria. RLS sozinha
-- não compara valor antigo x novo de forma direta pra UPDATE — o jeito padrão e seguro no
-- Postgres é um trigger BEFORE UPDATE, que tem acesso a OLD e NEW ao mesmo tempo.
create function public.prevent_self_role_ativo_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.role is distinct from old.role or new.ativo is distinct from old.ativo then
      raise exception 'Apenas administradores ativos podem alterar role ou ativo.';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_self_role_ativo_change
  before update on public.profiles
  for each row execute function public.prevent_self_role_ativo_change();

-- ============================================================
-- CATÁLOGO 2 — seleções de filtros salvas por usuário
-- ============================================================
-- Guarda CRITÉRIOS de filtro (categorias/linhas/marcas/buscas/ordenação), nunca uma lista
-- fixa de IDs de produto — assim a seleção continua dinâmica quando o catálogo mudar.

create table public.catalogo_selecoes (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  nome text not null,
  filtros jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index catalogo_selecoes_user_id_idx on public.catalogo_selecoes (user_id);

alter table public.catalogo_selecoes enable row level security;

-- Pertence só a quem criou, E só enquanto o usuário estiver ativo — uma conta desativada
-- (ex.: Cristian, após o período de suporte) perde acesso de fato às próprias seleções,
-- mas as linhas continuam no banco (preservação histórica), nunca são apagadas por isso.
create policy "catalogo_selecoes_select_own_active" on public.catalogo_selecoes
  for select using (user_id = auth.uid() and public.is_active_user());

create policy "catalogo_selecoes_insert_own_active" on public.catalogo_selecoes
  for insert with check (user_id = auth.uid() and public.is_active_user());

create policy "catalogo_selecoes_update_own_active" on public.catalogo_selecoes
  for update using (user_id = auth.uid() and public.is_active_user());

create policy "catalogo_selecoes_delete_own_active" on public.catalogo_selecoes
  for delete using (user_id = auth.uid() and public.is_active_user());

-- GRANT explícito desde já (RLS sozinha não libera acesso — pegadinha já registrada
-- neste projeto em 0007/0008 — aqui as 4 operações já entram corretas de uma vez).
grant select, insert, update, delete on public.catalogo_selecoes to authenticated;

-- service_role também precisa de GRANT explícito — "bypass RLS" e "ter privilégio na
-- tabela" são independentes no Postgres (mesma pegadinha de 0004_grants_service_role.sql,
-- que só cobriu as tabelas existentes na época e não alcança catalogo_selecoes, criada
-- agora). Achado e corrigido após aplicar esta migration — GRANT rodado manualmente no
-- SQL Editor, registrado aqui pra manter o arquivo fiel ao estado real do banco.
grant select, insert, update, delete on public.catalogo_selecoes to service_role;

notify pgrst, 'reload schema';
