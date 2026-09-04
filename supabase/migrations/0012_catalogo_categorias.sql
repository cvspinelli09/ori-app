-- ============================================================
-- 0012_catalogo_categorias.sql
-- Estrutura hierárquica administrável de categorias do catálogo
-- ============================================================

create table if not exists public.catalogo_categorias (
  id bigint generated always as identity primary key,
  nome text not null unique,
  parent_id bigint references public.catalogo_categorias(id) on delete restrict,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create index if not exists catalogo_categorias_parent_idx
  on public.catalogo_categorias(parent_id);

create index if not exists catalogo_categorias_ativo_idx
  on public.catalogo_categorias(ativo);


-- ============================================================
-- IMPORTAÇÃO INICIAL
-- Cada categoria atualmente existente em produtos entra como
-- categoria raiz. Nenhum produto é alterado nesta migration.
-- ============================================================

insert into public.catalogo_categorias (nome)
select distinct trim(categoria)
from public.produtos
where categoria is not null
  and trim(categoria) <> ''
on conflict (nome) do nothing;


-- ============================================================
-- AUDITORIA
-- ============================================================

create or replace function public.set_catalogo_categoria_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();

  if auth.uid() is not null then
    new.updated_by = auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists catalogo_categorias_set_auditoria
on public.catalogo_categorias;

create trigger catalogo_categorias_set_auditoria
before update on public.catalogo_categorias
for each row
execute function public.set_catalogo_categoria_auditoria();


-- ============================================================
-- PROTEÇÃO CONTRA CICLOS NA HIERARQUIA
-- Impede:
--   A -> A
--   A -> B -> A
--   A -> B -> C -> A
-- ============================================================

create or replace function public.prevent_catalogo_categoria_cycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cycle_found boolean;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.id is not null and new.parent_id = new.id then
    raise exception 'Uma categoria não pode ser pai dela mesma.';
  end if;

  if new.id is null then
    return new;
  end if;

  with recursive ancestors as (
    select
      id,
      parent_id
    from public.catalogo_categorias
    where id = new.parent_id

    union all

    select
      c.id,
      c.parent_id
    from public.catalogo_categorias c
    join ancestors a
      on c.id = a.parent_id
  )
  select exists (
    select 1
    from ancestors
    where id = new.id
  )
  into cycle_found;

  if cycle_found then
    raise exception 'Esta movimentação criaria um ciclo na hierarquia de categorias.';
  end if;

  return new;
end;
$$;

drop trigger if exists catalogo_categorias_prevent_cycle
on public.catalogo_categorias;

create trigger catalogo_categorias_prevent_cycle
before insert or update of parent_id
on public.catalogo_categorias
for each row
execute function public.prevent_catalogo_categoria_cycle();


-- ============================================================
-- RLS
-- Catálogo público pode ler a estrutura.
-- Somente administradores ativos podem alterá-la.
-- ============================================================

alter table public.catalogo_categorias enable row level security;

drop policy if exists catalogo_categorias_select_public
on public.catalogo_categorias;

create policy catalogo_categorias_select_public
on public.catalogo_categorias
for select
using (true);


drop policy if exists catalogo_categorias_insert_admin
on public.catalogo_categorias;

create policy catalogo_categorias_insert_admin
on public.catalogo_categorias
for insert
to authenticated
with check (public.is_admin());


drop policy if exists catalogo_categorias_update_admin
on public.catalogo_categorias;

create policy catalogo_categorias_update_admin
on public.catalogo_categorias
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());


drop policy if exists catalogo_categorias_delete_admin
on public.catalogo_categorias;

create policy catalogo_categorias_delete_admin
on public.catalogo_categorias
for delete
to authenticated
using (public.is_admin());


grant select
on public.catalogo_categorias
to anon, authenticated;

grant insert, update, delete
on public.catalogo_categorias
to authenticated;

grant select, insert, update, delete
on public.catalogo_categorias
to service_role;
