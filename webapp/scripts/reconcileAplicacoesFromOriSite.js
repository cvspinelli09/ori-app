#!/usr/bin/env node
// Strictly dry-run / read-only: only Supabase .select() is used, and the site snapshot is
// read from a local JSON file. No insert/update/delete/upsert/RPC is ever called.
//
// Reconciles the Supabase `produtos.aplicacoes` proposal from THREE sources, in this
// explicit priority order (see task): client decisions > Ori site snapshot > current
// Supabase data (only when safe) > empty. Title-parsing is intentionally NOT used here —
// see rebuildAplicacoesFromTitles.js for that superseded approach.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SITE_SNAPSHOT_PATH = 'C:\\Users\\Spinelli\\ori-site-produtos-2026-09-01.json';

// ---------------------------------------------------------------------------
// Client decisions (explicit, highest precedence)
// ---------------------------------------------------------------------------

const MUST_KEEP = new Set([
  '1248', '1249', '1250', '1251', '1252', '1253', '1254', '1255', '1256', '1257', '1258', '1259',
  '8100', '8101', '8102', '8103',
]);

const CANCEL_LIST = new Set(
  '70255,71413,71651,71691,74312,74314,74540,74571,75109,75151,75220,75230,75681,76010,76020,76040,76050,76060,76070,76080,76090,77010,77020,78130,78150,99901,99902'
    .split(',')
);

const FORGET_LIST = new Set(
  '1014M,1023M,1025M,3060,3141,3198,3282,4134,4274,4275,4902,4903,8586,8595,12421,20900,30250,30251,40347,40550,40551,40552,40553,40554,50370,50800,50801,50802,50803,50804,60094,60095,60096,60097,60100,60111,60143,60500,60501,60502,60503,60504,60505,60506,60507,60508,60509,60510,60511,60512,60513,60514,60515,60516,70255,70500,70501,70502,70503,70504,70505,70506,70507,71413,71651,71691,74312,74314,74540,74571,75109,75151,75220,75230,75681,76010,76020,76040,76050,76060,76070,76080,76090,77010,77020,78039,78130,78150,80054,80055,80058,80059,80115,85208,88500,88501,88502,88503,88504,88505,88506,88507,88508,88509,88510,88511,89009,89010,99901,99902'
    .split(',')
);

const EXCLUDE_SET = new Set([...CANCEL_LIST, ...FORGET_LIST]);

// codigo -> conversao override (already normalized to the client's literal text).
const CLIENT_OVERRIDES = {
  '1280': '20998',
  '2236': '30324 / 30774',
  '4133': '70837/70856',
  '7803': '18205/18207/18269/18271',
  '8024': '60486',
  '8100': '23136',
  '8101': '23137',
  '8102': '23138',
  '8103': '23139',
  '30202': '40980',
  '30242': '41035',
  '30267': '41305',
  '30404': '41548',
  '40477': '70495',
  '78055': '18084 – 18085',
  '80081': '60261',
  '85121': '11410',
  '86092': '15576',
  '88069': '70585',
};

// ---------------------------------------------------------------------------
// Small text utilities
// ---------------------------------------------------------------------------

const norm = (x) => String(x ?? '').replace(/\s+/g, ' ').trim();

function normKey(x) {
  return norm(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function decodeEntities(s) {
  return String(s ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(s) {
  return norm(decodeEntities(String(s ?? '').replace(/<[^>]*>/g, ' ')));
}

// Base64-then-HTML fields (veiculos, ano_apos, ate, descricao) are sometimes corrupted —
// the raw value decodes to base64-valid bytes that are NOT the expected HTML at all. We only
// trust a decode when it round-trips as valid base64 AND the result is empty or contains a
// recognizable <p> tag (the format used by every real example we found in the snapshot).
function decodeBase64Html(raw) {
  const s = norm(raw);
  if (!s) return { ok: true, html: '' };
  if (!/^[A-Za-z0-9+/=]+$/.test(s)) return { ok: false, html: '' };
  let buf;
  try { buf = Buffer.from(s, 'base64'); } catch { return { ok: false, html: '' }; }
  const roundTrip = buf.toString('base64').replace(/=+$/, '');
  if (roundTrip !== s.replace(/=+$/, '')) return { ok: false, html: '' };
  const html = buf.toString('utf8');
  const trimmed = html.trim();
  if (trimmed && !/<p[\s>]/i.test(trimmed)) return { ok: false, html: '' };
  return { ok: true, html };
}

// Splits a decoded <p>...</p><p>...</p> list into an array, preserving position — an item
// that is empty or just <br> becomes ''. Never reorders, never drops slots (positional
// alignment across veiculos/ano_apos/ate/geracao_fase depends on this).
function splitPTagList(html) {
  const h = norm(html);
  if (!h) return [];
  const matches = [...h.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
  if (!matches.length) {
    const bare = stripHtml(h);
    return bare ? [bare] : [];
  }
  return matches.map((m) => {
    const inner = m[1];
    if (/^\s*(?:<br\s*\/?>)?\s*$/i.test(inner)) return '';
    return stripHtml(inner);
  });
}

// numero_portas mapping: 0 and 7 both map to "" (7 is a known bad/legacy value in the
// site's own catalog — no longer corrected to 5, just cleared); 2/3/4/5 pass through as-is;
// a composite value already in the valid "2/4"-style format is preserved untouched; any
// other unexpected value is never inferred — cleared to "" and flagged for review.
const VALID_PORTAS_SINGLE = new Set(['2', '3', '4', '5']);
const PORTAS_CLEARED_KNOWN = new Set(['0', '7']);

function mapPortas(raw) {
  const v = norm(raw);
  if (!v || PORTAS_CLEARED_KNOWN.has(v)) return { value: '', flagged: false };
  if (VALID_PORTAS_SINGLE.has(v)) return { value: v, flagged: false };
  if (/^[2345](?:\/[2345])+$/.test(v)) return { value: v, flagged: false };
  return { value: '', flagged: true, note: `numero_portas="${v}" inesperado — não inferido, marcado para revisão` };
}

// geracao_fase is plain text like "GI / GI / GI / GI" or "GI / GI /  / GI / GI" (note the
// middle empty slot) — split on the literal separator, not on <p> tags.
function splitSlashList(text) {
  const t = norm(text);
  if (!t) return [];
  return t.split('/').map((x) => norm(x));
}

// ---------------------------------------------------------------------------
// Site snapshot loading + per-record structured extraction
// ---------------------------------------------------------------------------

function loadSiteSnapshot() {
  const raw = readFileSync(SITE_SNAPSHOT_PATH, 'utf8').replace(/^\uFEFF/, '');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('Snapshot do site não é um array na raiz — formato inesperado.');
  return data;
}

// Extracts the structured fields from one raw site record. Never throws — invalid/garbled
// sub-fields degrade to empty rather than aborting the whole record.
function extractSiteStructured(row) {
  const veiculosDecode = decodeBase64Html(row.veiculos);
  const anoDecode = decodeBase64Html(row.ano_apos);
  const ateDecode = decodeBase64Html(row.ate);

  const veiculos = veiculosDecode.ok ? splitPTagList(veiculosDecode.html) : [];
  const anoApos = anoDecode.ok ? splitPTagList(anoDecode.html) : [];
  const ate = ateDecode.ok ? splitPTagList(ateDecode.html) : [];
  const geracao = splitSlashList(row.geracao_fase);

  const portasResult = mapPortas(row.numero_portas);

  const observacoesRaw = norm(row.observacoes);
  const observacoes = observacoesRaw && observacoesRaw !== '-' ? observacoesRaw : '';

  const numeroConversao = norm(row.numero_conversao);

  return {
    produto_id: row.produto_id,
    marca: row.marca,
    original: row.original,
    veiculos,
    veiculosValid: veiculosDecode.ok,
    anoApos,
    anoAposValid: anoDecode.ok,
    ate,
    ateValid: ateDecode.ok,
    geracao,
    portas: portasResult.value,
    portasFlagged: portasResult.flagged,
    portasNote: portasResult.note ?? '',
    observacoes,
    numeroConversao,
  };
}

// ---------------------------------------------------------------------------
// Site matching (codigo + marca, then + original, else DUPLICATE_SITE)
// ---------------------------------------------------------------------------

function buildSiteIndex(siteRows) {
  const byCodigo = new Map();
  for (const row of siteRows) {
    const codigo = norm(row.codigo);
    if (!codigo) continue;
    if (!byCodigo.has(codigo)) byCodigo.set(codigo, []);
    byCodigo.get(codigo).push(row);
  }
  return byCodigo;
}

function matchSiteRecord(siteIndex, codigo, marca, original) {
  const sameCodigo = siteIndex.get(norm(codigo)) ?? [];
  const candidates1 = sameCodigo.filter((r) => normKey(r.marca) === normKey(marca));
  if (candidates1.length === 0) return { status: 'NO_MATCH', count: 0, record: null };
  if (candidates1.length === 1) return { status: 'MATCHED', count: 1, record: candidates1[0] };

  const origNorm = normKey(original);
  if (origNorm) {
    const candidates2 = candidates1.filter((r) => normKey(r.original) === origNorm);
    if (candidates2.length === 1) return { status: 'MATCHED', count: candidates1.length, record: candidates2[0] };
  }
  return { status: 'DUPLICATE', count: candidates1.length, record: null };
}

// ---------------------------------------------------------------------------
// Core reconciliation for one Supabase product
// ---------------------------------------------------------------------------

const APLICACAO_FIELDS = ['veiculo', 'geracao', 'ano_apos', 'ate', 'portas', 'obs', 'conversao'];

function emptyAplicacao() {
  return Object.fromEntries(APLICACAO_FIELDS.map((k) => [k, '']));
}

function currentUniformConversao(currentAplicacoes) {
  const values = [...new Set((currentAplicacoes ?? []).map((a) => norm(a.conversao)).filter(Boolean))];
  return values.length === 1 ? values[0] : '';
}

// Builds the "base" reconciliation result (before any client conversion override is layered
// on top): site matching + vehicle-list alignment + conversao waterfall (site > current).
function reconcileBase(product, siteIndex) {
  const { codigo, marca, original, aplicacoes: currentAplicacoes } = product;
  const match = matchSiteRecord(siteIndex, codigo, marca, original);

  if (match.status === 'NO_MATCH') {
    return {
      classification: 'NO_SITE_MATCH',
      reason: 'Nenhum registro do site com o mesmo código + marca (normalizado).',
      site_match_count: 0,
      site_structured: null,
      proposed_aplicacoes: currentAplicacoes ?? [],
      site_conversion: '',
    };
  }

  if (match.status === 'DUPLICATE') {
    return {
      classification: 'DUPLICATE_SITE',
      reason: `${match.count} registros do site compartilham código + marca; código + marca + original não resolveu para um único candidato.`,
      site_match_count: match.count,
      site_structured: null,
      proposed_aplicacoes: currentAplicacoes ?? [],
      site_conversion: '',
    };
  }

  const site = extractSiteStructured(match.record);
  // A veiculos list that decoded but every slot is empty (e.g. the whole field is just
  // "<p><br></p>") means the site genuinely has no vehicle data for this product — not a
  // single "empty vehicle". Treat that the same as an absent/undecodable field (count 0),
  // not as one slot to drop (which would wrongly downgrade to SITE_PARTIAL below).
  const hasAnyVeiculo = site.veiculos.some((v) => norm(v));
  const vehicleCount = hasAnyVeiculo ? site.veiculos.length : 0;
  const siteConversion = site.numeroConversao;

  if (vehicleCount === 0) {
    // Destrutivo removido por decisão explícita: sem dado estruturado do site, a aplicação
    // atual do Supabase é preservada sempre que existir — nunca é limpa só por falta de
    // suporte do site (independente de aplicacao_revisar). Só fica vazio quando as DUAS
    // fontes estão vazias.
    const currentNonEmpty = Array.isArray(currentAplicacoes) && currentAplicacoes.length > 0;
    if (!currentNonEmpty) {
      return {
        classification: 'NO_SITE_DATA',
        reason: 'Site casou o produto, mas o campo "veiculos" está vazio ou não pôde ser decodificado; base Supabase também já está vazia.',
        site_match_count: match.count,
        site_structured: site,
        proposed_aplicacoes: [],
        site_conversion: siteConversion,
      };
    }
    return {
      classification: 'KEEP_CURRENT',
      reason: 'Site sem dado de veículo utilizável; aplicações atuais do Supabase preservadas (nunca limpas só por falta de suporte do site).',
      site_match_count: match.count,
      site_structured: site,
      proposed_aplicacoes: currentAplicacoes,
      site_conversion: siteConversion,
    };
  }

  const misalignments = [];
  if (site.portasFlagged) misalignments.push(site.portasNote);

  // Expansão segura: 1 veículo + N gerações = repetir o mesmo veículo N vezes (uma
  // aplicação por geração). Quando ano_apos/ate também têm N itens, alinham por índice
  // junto com a geração; senão seguem a regra normal de broadcast/ausência abaixo.
  if (vehicleCount === 1 && site.geracao.length > 1) {
    const n = site.geracao.length;
    const veiculo = norm(site.veiculos[0]);
    if (!veiculo) misalignments.push('único slot de veiculos veio vazio');
    const anoPerIndex = site.anoAposValid && site.anoApos.length === n;
    const atePerIndex = site.ateValid && site.ate.length === n;
    if (site.anoAposValid && site.anoApos.length > 1 && !anoPerIndex) misalignments.push(`ano_apos tem ${site.anoApos.length} itens, geracao_fase (expandida) tem ${n}`);
    if (site.ateValid && site.ate.length > 1 && !atePerIndex) misalignments.push(`ate tem ${site.ate.length} itens, geracao_fase (expandida) tem ${n}`);
    const proposed = veiculo
      ? Array.from({ length: n }, (_, i) => ({
          ...emptyAplicacao(),
          veiculo,
          geracao: norm(site.geracao[i] ?? ''),
          ano_apos: anoPerIndex ? norm(site.anoApos[i] ?? '') : (site.anoApos.length === 1 ? norm(site.anoApos[0]) : ''),
          ate: atePerIndex ? norm(site.ate[i] ?? '') : (site.ate.length === 1 ? norm(site.ate[0]) : ''),
          portas: site.portas,
          obs: site.observacoes,
          conversao: siteConversion || currentUniformConversao(currentAplicacoes),
        }))
      : [];
    return {
      classification: 'SITE_PARTIAL',
      reason: `Expansão segura: 1 veículo do site repetido para ${n} gerações (geracao_fase)${misalignments.length ? '; ' + misalignments.join('; ') : ''}.`,
      site_match_count: match.count,
      site_structured: site,
      proposed_aplicacoes: proposed,
      site_conversion: siteConversion,
    };
  }

  // A list field is safely usable when: absent (nothing to align), exactly matches the
  // vehicle count (real per-position alignment), or has exactly ONE value while there are
  // several vehicles — the site uses this same "one shared value" shorthand for portas/
  // observacoes/numero_conversao (single fields, not lists), so a singleton geracao_fase/
  // ano_apos/ate is read the same way: broadcast to every vehicle, not a misalignment.
  const isBroadcastable = (list) => list.length === 0 || list.length === 1 || list.length === vehicleCount;
  const pick = (list, i) => (list.length === 1 ? list[0] : list[i]) ?? '';

  const geracaoAligned = isBroadcastable(site.geracao);
  const anoAligned = !site.anoAposValid || isBroadcastable(site.anoApos);
  const ateAligned = !site.ateValid || isBroadcastable(site.ate);

  if (!geracaoAligned) misalignments.push(`geracao_fase tem ${site.geracao.length} itens, veiculos tem ${vehicleCount}`);
  if (!anoAligned) misalignments.push(`ano_apos tem ${site.anoApos.length} itens, veiculos tem ${vehicleCount}`);
  if (!ateAligned) misalignments.push(`ate tem ${site.ate.length} itens, veiculos tem ${vehicleCount}`);
  if (!site.veiculosValid) misalignments.push('campo veiculos não pôde ser decodificado com segurança');

  const proposed = [];
  let droppedEmptySlot = false;
  for (let i = 0; i < vehicleCount; i++) {
    const veiculo = norm(site.veiculos[i]);
    if (!veiculo) { droppedEmptySlot = true; continue; }
    proposed.push({
      ...emptyAplicacao(),
      veiculo,
      geracao: geracaoAligned ? norm(pick(site.geracao, i)) : '',
      ano_apos: anoAligned ? norm(pick(site.anoApos, i)) : '',
      ate: ateAligned ? norm(pick(site.ate, i)) : '',
      portas: site.portas,
      obs: site.observacoes,
      conversao: siteConversion || currentUniformConversao(currentAplicacoes),
    });
  }
  if (droppedEmptySlot) misalignments.push('um ou mais slots de veiculos vieram vazios e foram descartados');

  const partial = misalignments.length > 0;
  return {
    classification: partial ? 'SITE_PARTIAL' : 'REBUILD_FROM_SITE',
    reason: partial
      ? `Reconstruído parcialmente a partir do site: ${misalignments.join('; ')}.`
      : 'Reconstruído a partir dos campos estruturados do site (veiculos/geracao_fase/ano_apos/ate/numero_portas/observacoes/numero_conversao), todos alinhados por posição.',
    site_match_count: match.count,
    site_structured: site,
    proposed_aplicacoes: proposed,
    site_conversion: siteConversion,
  };
}

function reconcileProduct(product, siteIndex) {
  const codigo = norm(product.codigo);

  if (EXCLUDE_SET.has(codigo)) {
    return {
      classification: 'CLIENT_EXCLUDE',
      reason: CANCEL_LIST.has(codigo)
        ? 'Código está na lista de cancelamento explícita do cliente (abaixo de "Demais pode Cancelar").'
        : 'Código está na lista de "não encontrados / esquece" explícita do cliente.',
      site_match_count: 0,
      site_structured: null,
      proposed_aplicacoes: [],
      current_conversion: currentUniformConversao(product.aplicacoes),
      site_conversion: '',
      final_conversion: '',
    };
  }

  const base = reconcileBase(product, siteIndex);
  const currentConversion = currentUniformConversao(product.aplicacoes);
  const override = CLIENT_OVERRIDES[codigo];

  if (override) {
    const proposedWithOverride = (base.proposed_aplicacoes ?? []).map((a) => ({ ...a, conversao: override }));
    return {
      classification: 'CLIENT_OVERRIDE',
      reason: `Conversão explícita do cliente aplicada (prevalece sobre site/Supabase). Status de veículo subjacente: ${base.classification} — ${base.reason}`,
      site_match_count: base.site_match_count,
      site_structured: base.site_structured,
      proposed_aplicacoes: proposedWithOverride,
      current_conversion: currentConversion,
      site_conversion: base.site_conversion,
      final_conversion: override,
    };
  }

  // Independent waterfall (site > current), same priority for every classification that
  // still proposes vehicle data. NO_SITE_DATA ends with an empty proposed_aplicacoes array
  // (both sources empty), so there is no application row to attach a conversao to —
  // final_conversion stays empty there (nothing invented, nothing dangling). Every other
  // classification (including KEEP_CURRENT and the untouched NO_SITE_MATCH/DUPLICATE_SITE
  // pass-through) never drops an existing conversao just because the site lacks one.
  const finalConversion =
    base.classification === 'NO_SITE_DATA' ? '' : base.site_conversion || currentConversion || '';

  return {
    classification: base.classification,
    reason: base.reason,
    site_match_count: base.site_match_count,
    site_structured: base.site_structured,
    proposed_aplicacoes: base.proposed_aplicacoes,
    current_conversion: currentConversion,
    site_conversion: base.site_conversion,
    final_conversion: finalConversion,
  };
}

// ---------------------------------------------------------------------------
// Supabase read
// ---------------------------------------------------------------------------

async function loadSupabaseProducts(client) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from('produtos')
      .select('codigo,marca,original,aplicacoes,aplicacao_revisar')
      .eq('ativo', true)
      .order('codigo')
      .range(offset, offset + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

// ---------------------------------------------------------------------------
// Coverage stats
// ---------------------------------------------------------------------------

function coverageStats(reports) {
  const stats = { veiculo: 0, geracao: 0, portas: 0, ano_apos: 0, ate: 0, obs: 0, conversao: 0 };
  for (const r of reports) {
    for (const a of r.proposed_aplicacoes) {
      if (norm(a.veiculo)) stats.veiculo++;
      if (norm(a.geracao)) stats.geracao++;
      if (norm(a.portas)) stats.portas++;
      if (norm(a.ano_apos)) stats.ano_apos++;
      if (norm(a.ate)) stats.ate++;
      if (norm(a.obs)) stats.obs++;
      if (norm(a.conversao)) stats.conversao++;
    }
  }
  return stats;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');

  const siteRows = loadSiteSnapshot();
  const siteIndex = buildSiteIndex(siteRows);

  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const products = await loadSupabaseProducts(client);

  const detailed = products.map((p) => {
    const result = reconcileProduct(p, siteIndex);
    return {
      codigo: p.codigo,
      marca: p.marca,
      site_produto_id: result.site_structured?.produto_id ?? null,
      classification: result.classification,
      reason: result.reason,
      site_match_count: result.site_match_count,
      current_aplicacoes: p.aplicacoes ?? [],
      site_structured: result.site_structured
        ? {
            veiculos: result.site_structured.veiculos,
            geracao: result.site_structured.geracao,
            ano_apos: result.site_structured.anoApos,
            ate: result.site_structured.ate,
            portas: result.site_structured.portas,
            observacoes: result.site_structured.observacoes,
            numero_conversao: result.site_structured.numeroConversao,
          }
        : null,
      proposed_aplicacoes: result.proposed_aplicacoes,
      current_conversion: result.current_conversion,
      site_conversion: result.site_conversion,
      final_conversion: result.final_conversion,
    };
  });

  const count = (cls) => detailed.filter((r) => r.classification === cls).length;
  const classifications = [
    'CLIENT_EXCLUDE', 'CLIENT_OVERRIDE', 'REBUILD_FROM_SITE', 'SITE_PARTIAL', 'KEEP_CURRENT',
    'NO_SITE_DATA', 'NO_SITE_MATCH', 'DUPLICATE_SITE', 'CONFLICT',
  ];
  const byClassification = Object.fromEntries(classifications.map((c) => [c, count(c)]));

  const withAplicacoes = detailed.filter((r) => r.proposed_aplicacoes.length > 0).length;
  const withoutAplicacoes = detailed.length - withAplicacoes;
  const conversionChanged = detailed.filter((r) => norm(r.final_conversion) !== norm(r.current_conversion)).length;
  const overridesApplied = detailed.filter((r) => r.classification === 'CLIENT_OVERRIDE').length;

  const summary = {
    total_supabase: products.length,
    total_site_snapshot: siteRows.length,
    site_matches_safe: detailed.filter((r) => ['REBUILD_FROM_SITE', 'SITE_PARTIAL', 'KEEP_CURRENT', 'NO_SITE_DATA'].includes(r.classification) && r.site_match_count === 1).length,
    no_site_match: byClassification.NO_SITE_MATCH,
    duplicate_site: byClassification.DUPLICATE_SITE,
    client_excluded: byClassification.CLIENT_EXCLUDE,
    by_classification: byClassification,
    produtos_com_aplicacoes_propostas: withAplicacoes,
    produtos_sem_aplicacao: withoutAplicacoes,
    produtos_com_conversao_alterada: conversionChanged,
    overrides_de_cliente_aplicados: overridesApplied,
    coverage_final: coverageStats(detailed),
    coverage_final_pct_sobre_com_aplicacoes: (() => {
      const cov = coverageStats(detailed);
      const totalItems = detailed.reduce((sum, r) => sum + r.proposed_aplicacoes.length, 0);
      if (!totalItems) return cov;
      return Object.fromEntries(Object.entries(cov).map(([k, v]) => [k, Number(((v / totalItems) * 100).toFixed(1))]));
    })(),
  };

  const dir = path.resolve('reports');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'reconcile-aplicacoes-site-dry-run.json'), JSON.stringify({ summary, products: detailed }, null, 2));
  await writeFile(path.join(dir, 'reconcile-aplicacoes-site-summary.json'), JSON.stringify(summary, null, 2));

  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main().catch((err) => { console.error(err); process.exitCode = 1; });
}

export { reconcileProduct, extractSiteStructured, decodeBase64Html, splitPTagList, splitSlashList, matchSiteRecord, buildSiteIndex };
