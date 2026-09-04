-- Flag pra marcar aplicações veiculares preenchidas/corrigidas por extração automática
-- de texto (não confirmadas pelo cliente ainda). Visível só no admin, nunca pro cliente final.
alter table public.produtos add column aplicacao_revisar boolean not null default false;
