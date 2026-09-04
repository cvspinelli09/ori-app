// Importa products.json (catálogo estático do demo) pra tabela produtos no Supabase.
// Uso: node scripts/import-products.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const products = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'products.json'), 'utf8')
);

function toRow(p) {
  return {
    codigo: p.codigo,
    original: p.original,
    numero_conversao: p.numero_conversao,
    conversao_conflict: !!p.conversao_conflict,
    descricao: p.descricao,
    marca: p.marca,
    categoria: p.categoria,
    linha: p.linha,
    veiculos: p.veiculos,
    aplicacoes: p.aplicacoes ?? [],
    peso_liquido: p.peso_liquido,
    barras: p.barras,
    barras_antigo: p.barras_antigo,
    ncm: p.ncm,
    cest: p.cest,
    ipi: p.ipi,
    curva_abc: p.curva_abc,
    dimensoes: p.dimensoes,
    embalagem: p.embalagem,
    marca_fabricante: p.marca_fabricante,
    status_excel: p.status_excel,
    foto_local: p.foto_local,
    foto_local_gde: p.foto_local_gde,
    preco: p.preco,
    galeria: p.galeria ?? [],
  };
}

async function main() {
  const rows = products.map(toRow);
  const batchSize = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from('produtos').upsert(batch, { onConflict: 'codigo' });
    if (error) {
      console.error(`Erro no lote ${i}-${i + batch.length}:`, error.message);
      process.exit(1);
    }
    inserted += batch.length;
    console.log(`Importados ${inserted}/${rows.length}`);
  }

  console.log('Concluído.');
}

main();
