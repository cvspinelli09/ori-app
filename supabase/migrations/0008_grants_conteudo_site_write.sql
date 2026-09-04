-- Mesma pegadinha de 0007: 0003_grants.sql só deu SELECT em conteudo_site
-- pra `authenticated`. A aba Admin > Destaques precisa gravar (upsert) nessa
-- tabela; a RLS "conteudo_site_write_admin" (0001_init.sql) já restringe a admin,
-- só falta o GRANT.

grant insert, update on public.conteudo_site to authenticated;

notify pgrst, 'reload schema';
