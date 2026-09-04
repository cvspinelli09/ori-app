-- Grants básicos pros papéis do Data API (anon = não logado, authenticated = logado).
-- RLS continua sendo a camada que realmente restringe linha a linha — isso aqui
-- só libera o acesso à tabela, que desmarcamos do "automatic expose" na criação do projeto.

grant usage on schema public to anon, authenticated;

grant select on public.produtos to anon, authenticated;
grant select on public.conteudo_site to anon, authenticated;

grant select, update on public.profiles to authenticated;

grant insert on public.leads to anon, authenticated;
grant select on public.leads to authenticated;

grant insert, select on public.vendedor_atividade to authenticated;
