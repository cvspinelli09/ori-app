-- service_role (chave secreta) também precisa de GRANT explícito nas tabelas —
-- "bypass RLS" e "ter privilégio na tabela" são coisas independentes no Postgres.

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
