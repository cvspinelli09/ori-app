-- Corrige recursão infinita nas policies que checavam "é admin?" consultando
-- a própria tabela profiles de dentro de uma policy sobre profiles (ou de
-- outra tabela que, ao consultar profiles, reaciona a policy de profiles).
-- Solução padrão do Supabase: função security definer, que ignora RLS.

create function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "produtos_write_admin" on public.produtos;
create policy "produtos_write_admin" on public.produtos
  for all using (public.is_admin());

drop policy if exists "leads_select_admin_or_own_vendedor" on public.leads;
create policy "leads_select_admin_or_own_vendedor" on public.leads
  for select using (public.is_admin() or vendedor_id = auth.uid());

drop policy if exists "vendedor_atividade_select_own_or_admin" on public.vendedor_atividade;
create policy "vendedor_atividade_select_own_or_admin" on public.vendedor_atividade
  for select using (vendedor_id = auth.uid() or public.is_admin());

drop policy if exists "conteudo_site_write_admin" on public.conteudo_site;
create policy "conteudo_site_write_admin" on public.conteudo_site
  for all using (public.is_admin());
