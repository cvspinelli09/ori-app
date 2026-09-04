#!/usr/bin/env node
// Strictly read-only audit: compares the CURRENT (post-write) Supabase state against the
// already-approved reconcile-aplicacoes-site-dry-run.json proposal. Only .select() is used —
// no insert/update/delete/upsert/rpc anywhere in this file.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DRY_RUN_REPORT_PATH = path.resolve('reports/reconcile-aplicacoes-site-dry-run.json');
const OUTPUT_PATH = path.resolve('reports/audit-post-write-aplicacoes.json');
const MAX_EXAMPLES = 20;

const norm = (x) => String(x ?? '').replace(/\s+/g, ' ').trim();
const normVeiculo = (x) => norm(x).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function loadDryRunReport() {
  const raw = readFileSync(DRY_RUN_REPORT_PATH, 'utf8').replace(/^﻿/, '');
  const report = JSON.parse(raw);
  if (!Array.isArray(report.products)) throw new Error('reconcile-aplicacoes-site-dry-run.json não tem "products".');
  return report;
}

async function fetchCurrentByCodigo(client) {
  const byCodigo = new Map();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from('produtos')
      .select('codigo,marca,aplicacoes')
      .eq('ativo', true)
      .order('codigo')
      .range(offset, offset + 999);
    if (error) throw error;
    for (const row of data) byCodigo.set(norm(row.codigo), row);
    if (data.length < 1000) break;
  }
  return byCodigo;
}

// Alinha proposed[i] com o current de mesmo veiculo, respeitando repetição (mesmo veiculo
// mais de uma vez -> consumido na ordem relativa em que aparece, sem inferir por título).
function matchApplications(proposed, current) {
  const queueByVeiculo = new Map();
  for (const c of current ?? []) {
    const key = normVeiculo(c.veiculo);
    if (!queueByVeiculo.has(key)) queueByVeiculo.set(key, []);
    queueByVeiculo.get(key).push(c);
  }
  return (proposed ?? []).map((p) => {
    const key = normVeiculo(p.veiculo);
    const queue = queueByVeiculo.get(key);
    const current = queue && queue.length ? queue.shift() : null;
    return { proposed: p, current };
  });
}

function slim(a) {
  if (!a) return null;
  return { veiculo: a.veiculo ?? '', geracao: a.geracao ?? '', ano_apos: a.ano_apos ?? '', ate: a.ate ?? '', portas: a.portas ?? '', obs: a.obs ?? '', conversao: a.conversao ?? '' };
}

async function main() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Defina SUPABASE_URL/VITE_SUPABASE_URL e uma chave de leitura (anon já basta — este script só faz select).');

  const report = loadDryRunReport();
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const currentByCodigo = await fetchCurrentByCodigo(client);

  const periodExamples = [];
  const generationExamples = [];
  let periodosAnoIgualAteTotal = 0;
  let periodosQueDeveriamSerAbertos = 0;
  let geracoesPropostasPreenchidas = 0;
  let geracoesPerdidasOuDiferentes = 0;

  const focusCodes = { '12119': null, '12137': null };

  for (const p of report.products) {
    const currentRow = currentByCodigo.get(norm(p.codigo));
    const currentAplicacoes = currentRow?.aplicacoes ?? [];
    const proposed = p.proposed_aplicacoes ?? [];
    const pairs = matchApplications(proposed, currentAplicacoes);

    if (Object.prototype.hasOwnProperty.call(focusCodes, p.codigo)) {
      focusCodes[p.codigo] = { codigo: p.codigo, marca: p.marca, classification: p.classification, pairs: pairs.map((pr) => ({ proposed: slim(pr.proposed), current: slim(pr.current) })) };
    }

    // Problema 1: período suspeito — olha o estado ATUAL de cada aplicação já cadastrada no
    // produto (não só as pareadas com a proposta), já que o problema é sobre o dado que está
    // na base agora, independente de ter sido tocado por este reconciliador ou não.
    for (const c of currentAplicacoes) {
      const anoApos = norm(c.ano_apos);
      const ate = norm(c.ate);
      if (!anoApos || ate !== anoApos) continue;
      periodosAnoIgualAteTotal++;

      const match = pairs.find((pr) => pr.current === c);
      const proposedAte = match ? norm(match.proposed?.ate) : undefined;
      const proposedAnoApos = match ? norm(match.proposed?.ano_apos) : undefined;
      const suspicious = match && proposedAte === '' && proposedAnoApos === anoApos;
      if (suspicious) {
        periodosQueDeveriamSerAbertos++;
        if (periodExamples.length < MAX_EXAMPLES) {
          periodExamples.push({ codigo: p.codigo, veiculo: c.veiculo, proposed: slim(match.proposed), current: slim(c) });
        }
      }
    }

    // Problema 2: geração perdida — olha os pares proposed<->current alinhados por veiculo.
    for (const { proposed: prop, current: cur } of pairs) {
      const propGeracao = norm(prop?.geracao);
      if (!propGeracao) continue;
      geracoesPropostasPreenchidas++;
      const curGeracao = norm(cur?.geracao);
      if (!curGeracao || curGeracao !== propGeracao) {
        geracoesPerdidasOuDiferentes++;
        if (generationExamples.length < MAX_EXAMPLES) {
          generationExamples.push({ codigo: p.codigo, veiculo: prop.veiculo, proposed: slim(prop), current: slim(cur) });
        }
      }
    }
  }

  const summary = {
    periodos_ano_igual_ate_total: periodosAnoIgualAteTotal,
    periodos_que_deveriam_ser_abertos: periodosQueDeveriamSerAbertos,
    geracoes_propostas_preenchidas: geracoesPropostasPreenchidas,
    geracoes_perdidas_ou_diferentes: geracoesPerdidasOuDiferentes,
  };

  const output = {
    generated_at: new Date().toISOString(),
    summary,
    periodo_suspeito_exemplos: periodExamples,
    geracao_perdida_exemplos: generationExamples,
    codigos_validados: {
      '12119': focusCodes['12119'],
      '12137': focusCodes['12137'],
    },
  };

  await mkdir(path.resolve('reports'), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2));

  const amarok12119 = focusCodes['12119']?.pairs.find((pr) => normVeiculo(pr.proposed?.veiculo) === normVeiculo('Amarok') || normVeiculo(pr.current?.veiculo) === normVeiculo('Amarok'));

  console.log(JSON.stringify({
    summary,
    periodo_suspeito_exemplos: periodExamples,
    geracao_perdida_exemplos: generationExamples,
    '12119_amarok': amarok12119 ?? null,
    '12137_todas_aplicacoes': focusCodes['12137'],
  }, null, 2));
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
