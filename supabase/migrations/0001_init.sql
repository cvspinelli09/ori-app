-- Ori Auto Peças — schema inicial
-- Convenção: tabelas em português (nomenclatura do domínio do cliente), snake_case.

-- ============================================================
-- PROFILES — estende auth.users com papel (role) e dados extras
-- ============================================================
create type public.user_role as enum ('cliente', 'vendedor', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'cliente',
  nome text,
  email text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- cria o profile automaticamente quando um usuário se cadastra no Supabase Auth
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, nome)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- PRODUTOS — catálogo (migrado de products.json)
-- ============================================================
create table public.produtos (
  id bigint generated always as identity primary key,
  codigo text not null unique,
  original text,
  numero_conversao text,
  conversao_conflict boolean not null default false,
  descricao text,
  marca text,
  categoria text,
  linha text,
  veiculos text,
  aplicacoes jsonb not null default '[]',
  peso_liquido text,
  barras text,
  barras_antigo text,
  ncm text,
  cest text,
  ipi text,
  curva_abc text,
  dimensoes text,
  embalagem text,
  marca_fabricante text,
  status_excel text,
  foto_local text,
  foto_local_gde text,
  preco numeric,
  galeria jsonb not null default '[]',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index produtos_marca_idx on public.produtos (marca);
create index produtos_categoria_idx on public.produtos (categoria);
create index produtos_linha_idx on public.produtos (linha);
create index produtos_descricao_trgm_idx on public.produtos using gin (descricao gin_trgm_ops);
create extension if not exists pg_trgm;

-- ============================================================
-- LEADS — captura de clientes que geraram catálogo
-- ============================================================
create table public.leads (
  id bigint generated always as identity primary key,
  nome text not null,
  email text,
  telefone text,
  empresa text,
  vendedor_id uuid references public.profiles(id),
  produtos_selecionados jsonb not null default '[]',
  origem text not null default 'catalogo_pdf',
  created_at timestamptz not null default now()
);

-- ============================================================
-- ATIVIDADE DE VENDEDOR — acompanhamento de uso pelos ~20 vendedores
-- ============================================================
create table public.vendedor_atividade (
  id bigint generated always as identity primary key,
  vendedor_id uuid not null references public.profiles(id) on delete cascade,
  tipo text not null, -- 'login' | 'catalogo_gerado' | 'lead_capturado'
  detalhe jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ============================================================
-- CONTEÚDO EDITÁVEL DO SITE (banners, instagram — prototipado no admin-destaque.html)
-- ============================================================
create table public.conteudo_site (
  chave text primary key, -- ex: 'banners', 'instagram'
  valor jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

-- ============================================================
-- RLS
-- ============================================================
alter table public.profiles enable row level security;
alter table public.produtos enable row level security;
alter table public.leads enable row level security;
alter table public.vendedor_atividade enable row level security;
alter table public.conteudo_site enable row level security;

-- profiles: usuário vê/edita o próprio; admin vê tudo
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (
    auth.uid() = id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- produtos: leitura pública (catálogo é público), escrita só admin
create policy "produtos_select_public" on public.produtos
  for select using (true);

create policy "produtos_write_admin" on public.produtos
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- leads: qualquer um autenticado ou anônimo pode inserir (captura de lead);
-- leitura só admin e vendedores (vendedor vê só os próprios)
create policy "leads_insert_any" on public.leads
  for insert with check (true);

create policy "leads_select_admin_or_own_vendedor" on public.leads
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or vendedor_id = auth.uid()
  );

-- vendedor_atividade: vendedor insere/vê a própria; admin vê tudo
create policy "vendedor_atividade_insert_own" on public.vendedor_atividade
  for insert with check (vendedor_id = auth.uid());

create policy "vendedor_atividade_select_own_or_admin" on public.vendedor_atividade
  for select using (
    vendedor_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- conteudo_site: leitura pública, escrita só admin
create policy "conteudo_site_select_public" on public.conteudo_site
  for select using (true);

create policy "conteudo_site_write_admin" on public.conteudo_site
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
