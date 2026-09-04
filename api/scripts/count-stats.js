require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase
    .from('produtos')
    .select('categoria, aplicacoes, ativo')
    .limit(5000);
  if (error) { console.error(error); process.exit(1); }

  const ativos = data.filter((p) => p.ativo);
  const categorias = new Set(ativos.map((p) => p.categoria).filter(Boolean));

  let totalAplicacoesEntries = 0;
  const veiculosUnicos = new Set();
  let produtosComAplicacao = 0;
  let produtosSemAplicacao = 0;

  ativos.forEach((p) => {
    const aps = Array.isArray(p.aplicacoes) ? p.aplicacoes : [];
    if (aps.length > 0) produtosComAplicacao++; else produtosSemAplicacao++;
    totalAplicacoesEntries += aps.length;
    aps.forEach((a) => {
      if (a.veiculo) veiculosUnicos.add(a.veiculo.trim().toLowerCase());
    });
  });

  console.log('Total de produtos ativos:', ativos.length);
  console.log('Categorias distintas:', categorias.size);
  console.log('---');
  console.log('Produtos com pelo menos 1 aplicação veicular:', produtosComAplicacao);
  console.log('Produtos sem nenhuma aplicação veicular:', produtosSemAplicacao);
  console.log('Total de entradas de aplicação (linhas veículo+ano, somando todos os produtos):', totalAplicacoesEntries);
  console.log('Veículos/modelos distintos cobertos (nome normalizado):', veiculosUnicos.size);
}

main();
