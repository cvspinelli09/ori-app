// Segunda passada, mais permissiva: preenche aplicação mesmo quando a contagem de
// veículo na planilha não bate 100% com a descrição (ex: um veículo do grupo ficou de
// fora da extração original) -- decisão explícita do usuário: informação um pouco
// imprecisa aqui é baixo risco (sempre marcada aplicacao_revisar=true, visível só no
// admin), bem diferente do bug de encoding (esse sim, sempre zerado, nunca aproximado).
// Só continua de fora quem não tem ANO NENHUM em lugar nenhum (nada seguro a atribuir).
//
// Uso: node scripts/fill-aplicacoes-permissivo.js [--apply]
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

async function main() {
  const wb = XLSX.readFile(path.join(__dirname, '..', '..', 'assets', 'cadastro', 'Ori - Descricoes Completas.xlsx'));
  const ws = wb.Sheets['Descrições Completas'];
  const planilha = XLSX.utils.sheet_to_json(ws, { defval: '' });

  const { data: produtos, error } = await supabase.from('produtos').select('id, codigo, aplicacoes').limit(5000);
  if (error) { console.error(error); process.exit(1); }
  const byCodigo = new Map(produtos.map((p) => [p.codigo, p]));

  const updates = [];
  const semAno = [];
  for (const row of planilha) {
    const codigo = String(row['Código Ori']).trim();
    const p = byCodigo.get(codigo);
    if (!p) continue;

    // só mexe em quem ainda está vazio hoje (a passada anterior já tratou corrompido + preenchido seguro)
    if (p.aplicacoes && p.aplicacoes.length > 0) continue;

    const aplicacaoStr = String(row['Aplicação (Veículos)'] || '').trim();
    if (!aplicacaoStr) { semAno.push(codigo); continue; }

    const parsed = parseAplicacao(aplicacaoStr);
    if (!parsed.ok || parsed.entries.length === 0) { semAno.push(codigo); continue; }

    updates.push({
      id: p.id,
      codigo,
      aplicacoes: parsed.entries,
      aplicacao_revisar: true,
    });
  }

  console.log(`Total de atualizações permissivas: ${updates.length}`);
  console.log(`Sem ano nenhum disponível (continuam vazios): ${semAno.length}`);
  console.log('\nAmostra do que vai ser preenchido:');
  updates.slice(0, 10).forEach((u) => console.log(' -', u.codigo, JSON.stringify(u.aplicacoes.map((a) => `${a.veiculo} [${a.ano_apos || '-'} a ${a.ate || '-'}]`))));

  if (!APPLY) {
    console.log('\nModo dry-run (sem --apply). Nada foi escrito.');
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
