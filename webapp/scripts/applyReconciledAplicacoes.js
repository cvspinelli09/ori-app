#!/usr/bin/env node
// Applies the ALREADY-APPROVED proposal from reports/reconcile-aplicacoes-site-dry-run.json
// to Supabase. Nothing is recomputed here — this script only reads that report, diffs it
// against a freshly-fetched current state, backs up whatever it's about to touch, and
// writes `aplicacoes` via .update() (never insert/delete/upsert/rpc).
//
// Safety gate: without --apply this NEVER calls the database for writes — it only reads
// (for the diff) and prints the plan. Only --apply performs the backup + updates.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DRY_RUN_REPORT_PATH = path.resolve('reports/reconcile-aplicacoes-site-dry-run.json');
const BACKUP_PATH = path.resolve('reports/backup-produtos-before-aplicacoes-write-2026-09-01.json');
const POST_WRITE_VALIDATION_PATH = path.resolve('reports/aplicacoes-post-write-validation.json');

// Classes elegíveis pra update, exatamente como decidido pelo dry-run (regra 3 da tarefa).
// NO_SITE_DATA nunca entra aqui — "sem mudança não precisa gerar update" é tratado como
// "nunca considerar", evitando o risco de sobrescrever dado que tenha surgido depois do
// dry-run. DUPLICATE_SITE e CONFLICT também nunca entram.
const APPLICABLE_CLASSIFICATIONS = new Set(['REBUILD_FROM_SITE', 'SITE_PARTIAL', 'KEEP_CURRENT', 'CLIENT_OVERRIDE']);

const APLICACAO_FIELDS = ['veiculo', 'geracao', 'ano_apos', 'ate', 'portas', 'obs', 'conversao'];
const norm = (x) => String(x ?? '').replace(/\s+/g, ' ').trim();

// Canonicaliza uma lista de aplicações pra comparação: normaliza espaços, ordem das chaves
// dentro de cada item, e null/undefined vs string vazia — mas preserva a ORDEM dos itens no
// array (aplicacoes é jsonb array; ordem importa pro dado real armazenado).
function canon(arr) {
  return JSON.stringify((arr ?? []).map((a) => APLICACAO_FIELDS.map((k) => norm(a?.[k]))));
}

function loadDryRunReport() {
  const raw = readFileSync(DRY_RUN_REPORT_PATH, 'utf8').replace(/^﻿/, '');
  const report = JSON.parse(raw);
  if (!Array.isArray(report.products)) throw new Error('reconcile-aplicacoes-site-dry-run.json não tem "products" — rode o reconciliador antes.');
  return report;
}

async function fetchCurrentByCodigo(client, codigos) {
  const byCodigo = new Map();
  for (let i = 0; i < codigos.length; i += 200) {
    const chunk = codigos.slice(i, i + 200);
    const { data, error } = await client
      .from('produtos')
      .select('id,codigo,marca,aplicacoes,aplicacao_revisar,numero_conversao,conversao_conflict,ativo')
      .in('codigo', chunk);
    if (error) throw error;
    for (const row of data) byCodigo.set(norm(row.codigo), row);
  }
  return byCodigo;
}

// Monta o plano: pra cada produto elegível do dry-run, decide se precisa update comparando
// o proposed_aplicacoes do relatório (fonte exclusiva, nunca recalculado) contra o estado
// ATUAL recém-buscado do Supabase — não contra o current_aplicacoes congelado no relatório,
// pra pegar qualquer mudança real acontecida depois da geração do dry-run.
function buildPlan(report, currentByCodigo) {
  const skipped = { nao_encontrado: [], ja_identico: [], classificacao_nao_elegivel: 0 };
  const toUpdate = [];

  for (const p of report.products) {
    if (!APPLICABLE_CLASSIFICATIONS.has(p.classification)) { skipped.classificacao_nao_elegivel++; continue; }

    const current = currentByCodigo.get(norm(p.codigo));
    if (!current) { skipped.nao_encontrado.push({ codigo: p.codigo, marca: p.marca }); continue; }

    const currentCanon = canon(current.aplicacoes);
    const proposedCanon = canon(p.proposed_aplicacoes);
    if (currentCanon === proposedCanon) { skipped.ja_identico.push({ codigo: p.codigo, marca: p.marca }); continue; }

    toUpdate.push({
      id: current.id,
      codigo: p.codigo,
      marca: p.marca,
      classification: p.classification,
      current_aplicacoes: current.aplicacoes,
      current_aplicacao_revisar: current.aplicacao_revisar,
      current_numero_conversao: current.numero_conversao,
      current_conversao_conflict: current.conversao_conflict,
      proposed_aplicacoes: p.proposed_aplicacoes,
    });
  }

  return { toUpdate, skipped };
}

async function writeBackup(toUpdate) {
  const rows = toUpdate.map((p) => ({
    id: p.id,
    codigo: p.codigo,
    marca: p.marca,
    aplicacoes: p.current_aplicacoes,
    aplicacao_revisar: p.current_aplicacao_revisar,
    numero_conversao: p.current_numero_conversao,
    conversao_conflict: p.current_conversao_conflict,
  }));
  await mkdir(path.resolve('reports'), { recursive: true });
  await writeFile(BACKUP_PATH, JSON.stringify({ generated_at: new Date().toISOString(), total: rows.length, rows }, null, 2));
  return rows.length;
}

// Só update() em `aplicacoes`, nunca insert/delete/upsert/rpc. Processa em lotes pequenos e
// registra falha por produto individualmente — uma falha não aborta o lote inteiro nem perde
// rastreabilidade de quais itens deram certo/errado.
async function applyUpdates(client, toUpdate) {
  const BATCH_SIZE = 25;
  const updated = [];
  const failed = [];

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (p) => {
      const { error } = await client.from('produtos').update({ aplicacoes: p.proposed_aplicacoes }).eq('id', p.id);
      if (error) failed.push({ id: p.id, codigo: p.codigo, marca: p.marca, error: error.message });
      else updated.push({ id: p.id, codigo: p.codigo, marca: p.marca, classification: p.classification });
    }));
  }

  return { updated, failed };
}

const CANCEL_LIST = new Set(
  '70255,71413,71651,71691,74312,74314,74540,74571,75109,75151,75220,75230,75681,76010,76020,76040,76050,76060,76070,76080,76090,77010,77020,78130,78150,99901,99902'.split(',')
);
const FORGET_LIST = new Set(
  '1014M,1023M,1025M,3060,3141,3198,3282,4134,4274,4275,4902,4903,8586,8595,12421,20900,30250,30251,40347,40550,40551,40552,40553,40554,50370,50800,50801,50802,50803,50804,60094,60095,60096,60097,60100,60111,60143,60500,60501,60502,60503,60504,60505,60506,60507,60508,60509,60510,60511,60512,60513,60514,60515,60516,70255,70500,70501,70502,70503,70504,70505,70506,70507,71413,71651,71691,74312,74314,74540,74571,75109,75151,75220,75230,75681,76010,76020,76040,76050,76060,76070,76080,76090,77010,77020,78039,78130,78150,80054,80055,80058,80059,80115,85208,88500,88501,88502,88503,88504,88505,88506,88507,88508,88509,88510,88511,89009,89010,99901,99902'.split(',')
);
const CLIENT_EXCLUDED_CODES = new Set([...CANCEL_LIST, ...FORGET_LIST]);

const CLIENT_OVERRIDE_CODES = ['1280', '2236', '4133', '7803', '8024', '8100', '8101', '8102', '8103', '30202', '30242', '30267', '30404', '40477', '78055', '80081', '85121', '86092', '88069'];
const CLIENT_OVERRIDE_MAP = {
  '1280': '20998', '2236': '30324 / 30774', '4133': '70837/70856', '7803': '18205/18207/18269/18271',
  '8024': '60486', '8100': '23136', '8101': '23137', '8102': '23138', '8103': '23139',
  '30202': '40980', '30242': '41035', '30267': '41305', '30404': '41548', '40477': '70495',
  '78055': '18084 – 18085', '80081': '60261', '85121': '11410', '86092': '15576', '88069': '70585',
};

async function runPostWriteValidation(client, report, updateOutcome) {
  const { data: allActive, error } = await client.from('produtos').select('codigo,marca,ativo,aplicacoes').eq('ativo', true);
  if (error) throw error;

  const totalAtivos = allActive.length;
  const byCodigo = new Map(allActive.map((r) => [norm(r.codigo), r]));

  const codigosExcluidosReaparecidos = [...CLIENT_EXCLUDED_CODES].filter((c) => byCodigo.has(norm(c)));

  const overridesOk = [];
  const overridesRuins = [];
  for (const codigo of CLIENT_OVERRIDE_CODES) {
    const row = byCodigo.get(norm(codigo));
    const expected = CLIENT_OVERRIDE_MAP[codigo];
    const actualConversoes = row ? [...new Set((row.aplicacoes ?? []).map((a) => norm(a.conversao)))] : [];
    const ok = row && actualConversoes.length === 1 && actualConversoes[0] === expected;
    (ok ? overridesOk : overridesRuins).push({ codigo, expected, actual: row ? actualConversoes : null, produto_encontrado: !!row });
  }

  let comAplicacoes = 0;
  let semAplicacoes = 0;
  let comPortasSete = [];
  for (const row of allActive) {
    const aps = row.aplicacoes ?? [];
    if (aps.length > 0) comAplicacoes++; else semAplicacoes++;
    for (const a of aps) if (norm(a.portas) === '7') comPortasSete.push({ codigo: row.codigo, marca: row.marca });
  }

  const duplicateSiteCodigos = report.products.filter((p) => p.classification === 'DUPLICATE_SITE').map((p) => p.codigo);
  const duplicateSiteAlterados = updateOutcome.updated.filter((u) => duplicateSiteCodigos.includes(u.codigo));

  const validation = {
    generated_at: new Date().toISOString(),
    total_produtos_ativos: totalAtivos,
    total_esperado: 3515,
    total_bate_com_esperado: totalAtivos === 3515,
    codigos_excluidos_que_reapareceram: codigosExcluidosReaparecidos,
    overrides_conversao: {
      total_esperado: CLIENT_OVERRIDE_CODES.length,
      corretos: overridesOk.length,
      incorretos: overridesRuins,
    },
    produtos_com_portas_igual_a_7: comPortasSete,
    produtos_com_aplicacoes: comAplicacoes,
    produtos_sem_aplicacoes: semAplicacoes,
    duplicate_site_alterados_indevidamente: duplicateSiteAlterados,
    updates_executados: updateOutcome.updated.length,
    updates_com_falha: updateOutcome.failed.length,
    falhas: updateOutcome.failed,
  };

  await writeFile(POST_WRITE_VALIDATION_PATH, JSON.stringify(validation, null, 2));
  return validation;
}

async function main() {
  const apply = process.argv.includes('--apply');

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (chave de serviço — a chave anônima não passa pela RLS de escrita em produtos). Ex.: node --env-file=.env --env-file=../api/.env scripts/applyReconciledAplicacoes.js');
  }

  const report = loadDryRunReport();
  const codigos = report.products.filter((p) => APPLICABLE_CLASSIFICATIONS.has(p.classification)).map((p) => p.codigo);

  const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const currentByCodigo = await fetchCurrentByCodigo(client, codigos);
  const { toUpdate, skipped } = buildPlan(report, currentByCodigo);

  if (!apply) {
    console.log(JSON.stringify({
      modo: 'PREVIEW (sem --apply — nenhum write foi feito)',
      candidatos_elegiveis: codigos.length,
      nao_encontrados_no_supabase: skipped.nao_encontrado.length,
      ja_identicos_sem_necessidade_de_update: skipped.ja_identico.length,
      produtos_que_serao_atualizados: toUpdate.length,
      amostra_produtos_a_atualizar: toUpdate.slice(0, 10).map((p) => ({ codigo: p.codigo, marca: p.marca, classification: p.classification })),
    }, null, 2));
    return;
  }

  if (toUpdate.length === 0) {
    console.log('Nada a atualizar — plano vazio. Nenhum backup necessário, nenhum write feito.');
    return;
  }

  const backupCount = await writeBackup(toUpdate);
  console.log(`Backup gravado com sucesso: ${BACKUP_PATH} (${backupCount} linhas) — iniciando updates.`);

  const updateOutcome = await applyUpdates(client, toUpdate);
  console.log(`Updates: ${updateOutcome.updated.length} ok, ${updateOutcome.failed.length} falharam.`);

  const validation = await runPostWriteValidation(client, report, updateOutcome);
  console.log(JSON.stringify(validation, null, 2));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main().catch((err) => { console.error(err); process.exitCode = 1; });
}

export { canon, buildPlan, fetchCurrentByCodigo };
