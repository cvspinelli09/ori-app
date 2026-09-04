// Corrige aplicações veiculares corrompidas (bug de encoding) e preenche as vazias,
// usando "Ori - Descricoes Completas.xlsx" como fonte -- SÓ quando a extração bate
// com segurança (validações abaixo). Tudo que ficou marcado como "precisa revisar" no
// dry-run entra com aplicacao_revisar = true (visível só no admin).
//
// Pré-requisito: rodar api/scripts/backup-produtos.js antes.
// Uso: node scripts/fix-fill-aplicacoes.js [--apply]   (sem --apply = dry-run, só imprime)
require('dotenv').config();
const XLSX = require('xlsx');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const APPLY = process.argv.includes('--apply');

function isCorrupted(str) {
  if (!str) return false;
  return /[^\x20-\x7EÀ-ÿ]/.test(str);
}

function currentAplicacoesCorrupted(aplicacoes) {
  if (!aplicacoes || aplicacoes.length === 0) return false;
  return aplicacoes.some(
    (a) => isCorrupted(a.veiculo) || isCorrupted(a.ano_apos) || isCorrupted(a.ate) || isCorrupted(a.geracao) || isCorrupted(a.obs)
  );
}

const ENTRY_RE = /^(.+?)\s*\((?:(\d{2,4})\s*a\s*(\d{2,4})|após\s*(\d{2,4})|até\s*(\d{2,4}))\)$/i;

function parseAplicacao(str) {
  if (!str || !str.trim()) return { entries: [], ok: true };
  const parts = str.split(' / ').map((s) => s.trim()).filter(Boolean);
  const entries = [];
  for (const part of parts) {
    const m = part.match(ENTRY_RE);
    if (!m) return { ok: false };
    const veiculo = m[1].trim();
    if (!veiculo || isCorrupted(veiculo)) return { ok: false };
    let ano_apos = '';
    let ate = '';
    if (m[2] && m[3]) { ano_apos = m[2]; ate = m[3]; }
    else if (m[4]) { ano_apos = m[4]; ate = ''; }
    else if (m[5]) { ano_apos = ''; ate = m[5]; }
    entries.push({ veiculo, ano_apos, ate, geracao: '', portas: '', obs: '' });
  }
  return { entries, ok: true };
}

const stripAbrev = (s) => s.replace(/\b[csCS]\/\s*/g, '');

async function main() {
  const wb = XLSX.readFile(path.join(__dirname, '..', '..', 'assets', 'cadastro', 'Ori - Descricoes Completas.xlsx'));
  const ws = wb.Sheets['Descrições Completas'];
  const planilha = XLSX.utils.sheet_to_json(ws, { defval: '' });

  const { data: produtos, error } = await supabase.from('produtos').select('id, codigo, aplicacoes').limit(5000);
  if (error) { console.error(error); process.exit(1); }
  const byCodigo = new Map(produtos.map((p) => [p.codigo, p]));

  const updates = [];
  for (const row of planilha) {
    const codigo = String(row['Código Ori']).trim();
    const p = byCodigo.get(codigo);
    if (!p) continue;

    const aplicacaoStr = String(row['Aplicação (Veículos)'] || '').trim();
    const isEmptyCurrent = !p.aplicacoes || p.aplicacoes.length === 0;
    const isCorruptedCurrent = currentAplicacoesCorrupted(p.aplicacoes);
    if (!isEmptyCurrent && !isCorruptedCurrent) continue;
    if (!aplicacaoStr) continue;

    const parsed = parseAplicacao(aplicacaoStr);
    if (!parsed.ok) continue;

    const slashesDescricao = (stripAbrev(String(row['Descrição Final Sugerida'])).match(/\//g) || []).length;
    const slashesAplicacao = (aplicacaoStr.match(/\//g) || []).length;
    if (slashesDescricao > slashesAplicacao) continue;

    updates.push({
      id: p.id,
      codigo,
      aplicacoes: parsed.entries,
      aplicacao_revisar: String(row['Precisa Revisar?']).trim().toLowerCase() === 'sim',
    });
  }

  console.log(`Total de atualizações válidas: ${updates.length}`);
  if (!APPLY) {
    console.log('Modo dry-run (sem --apply). Nada foi escrito. Amostra:');
    updates.slice(0, 5).forEach((u) => console.log(' -', u.codigo, JSON.stringify(u.aplicacoes)));
    return;
  }

  let done = 0;
  for (const u of updates) {
    const { error } = await supabase
      .from('produtos')
      .update({ aplicacoes: u.aplicacoes, aplicacao_revisar: u.aplicacao_revisar })
      .eq('id', u.id);
    if (error) { console.error(`Erro no código ${u.codigo}:`, error.message); continue; }
    done++;
    if (done % 100 === 0) console.log(`${done}/${updates.length}`);
  }
  console.log(`Concluído: ${done}/${updates.length} atualizados.`);
}

main();
