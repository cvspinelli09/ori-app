-- Região (cidade/estado) do lead que baixou o catálogo em PDF. Preenchida por
-- estimativa de IP (aproximada, pode errar com VPN/rede móvel) mas sempre
-- confirmável/editável pela pessoa antes do download — nunca apresentada
-- como dado 100% garantido, só uma sugestão de partida.

alter table public.leads add column regiao text;
