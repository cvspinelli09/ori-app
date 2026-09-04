// Varredura final: qualquer produto que AINDA tem aplicacoes corrompida (mojibake) após
// a passada anterior (fix-fill-aplicacoes.js) -- ou seja, não tinha substituto limpo e
// confiável na planilha -- tem a aplicação zerada (nunca mostrar lixo, mesmo sem dado novo).
// Uso: node scripts/clear-remaining-corrupted.js [--apply]
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');

function isCorrupted(str) {
  if (!str) return false;
  return /[^\x20-\x7EÀ-ÿ]/.test(str);
}
function aplicacoesCorrupted(aplicacoes) {
  if (!aplicacoes || aplicacoes.length === 0) return false;
  return aplicacoes.some(
    (a) => isCorrupted(a.veiculo) || isCorrupted(a.ano_apos) || isCorrupted(a.ate) || isCorrupted(a.geracao) || isCorrupted(a.obs)
  );
}

async function main() {
  const { data: produtos, error } = await supabase.from('produtos').select('id, codigo, descricao, aplicacoes').limit(5000);
  if (error) { console.error(error); process.exit(1); }

  const corrompidos = produtos.filter((p) => aplicacoesCorrupted(p.aplicacoes));
  console.log(`Ainda corrompidos: ${corrompidos.length}`);
  corrompidos.slice(0, 15).forEach((p) => console.log(' -', p.codigo, '|', p.descricao));

  if (!APPLY) {
    console.log('\nModo dry-run (sem --apply). Nada foi escrito.');
    return;
  }

  let done = 0;
  for (const p of corrompidos) {
    const { error } = await supabase.from('produtos').update({ aplicacoes: [] }).eq('id', p.id);
    if (error) { console.error(`Erro no código ${p.codigo}:`, error.message); continue; }
    done++;
  }
  console.log(`Concluído: ${done}/${corrompidos.length} limpos.`);
}

main();
