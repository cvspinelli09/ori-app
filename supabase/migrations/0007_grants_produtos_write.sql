-- 0003_grants.sql só liberou SELECT em produtos pra `authenticated`.
-- A RLS "produtos_write_admin" (0001_init.sql) já restringe escrita a admins,
-- mas sem o GRANT explícito o Postgres bloqueia antes de avaliar a RLS
-- (GRANT e RLS são camadas independentes no Postgres/PostgREST).

grant insert, update, delete on public.produtos to authenticated;

notify pgrst, 'reload schema';
