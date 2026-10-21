import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCatalogGeneration, validateCatalogGeneration, saveCatalogGeneration, readCatalogGeneration,
  readPdfGeneration, loadPdfGeneration, generationUrl, waitForPdfImages, recordCatalogLead, PENDING_GENERATION_KEY } from '../../src/lib/catalogoGeneration.js';
import { relatedFamiliesForFilters, loadCatalogFamilies } from '../../src/lib/catalogoFamilias.js';

export const FAMILY = '02076a1f-4cc4-446e-9037-d0f73a9a9e71';
export const GENERATION = '10000000-0000-4000-8000-000000000001';
export const memoryStorage = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) }; };
export const fixtureTables = () => ({
  produtos: [
    { id: '2474', codigo: '7701', descricao: 'Produto A', marca: 'Nissan', marcas: ['Nissan'], categoria: 'Fechaduras', linha: 'Leve', ativo: true, aplicacoes: [{ veiculo: 'Frontier' }], original: 'OR1' },
    { id: '2475', codigo: '7702', descricao: 'Produto B', marca: 'Outra', marcas: ['Outra'], categoria: 'Maçanetas', linha: 'Van', ativo: true, numero_conversao: 'CV2', barras: '1234' },
  ],
  catalogo_familias: [{ id: FAMILY, nome: 'Frontier 09 a 16', marca: 'Nissan', veiculo: 'Frontier', anos: '2009–2016', ordem: 0, ativo: true }],
  catalogo_familias_paginas: [
    { id: 'page-2', familia_id: FAMILY, ordem: 2, ativo: true, imagem_url: '/page-2.svg' },
    { id: 'page-0', familia_id: FAMILY, ordem: 0, ativo: true, imagem_url: '/page-0.svg' },
    { id: 'page-hidden', familia_id: FAMILY, ordem: 1, ativo: false, imagem_url: '/hidden.svg' },
  ],
  catalogo_familias_produtos: [{ familia_id: FAMILY, produto_id: '2474' }, { familia_id: FAMILY, produto_id: '2475' }],
  catalogo_linhas: [{ id: 'line-1', nome: 'Leve', ativo: true }],
  catalogo_familias_linhas: [{ familia_id: FAMILY, linha_id: 'line-1' }],
});

export function mockClient(tables, cap = 2) {
  const calls = [], inserts = [];
  return { calls, inserts, from(table) {
    const conditions = [], orders = [];
    let start = 0, end = Infinity;
    const query = {
      select(fields) { calls.push({ table, fields }); return query; },
      eq(field, value) { conditions.push(row => row[field] === value); return query; },
      in(field, values) { conditions.push(row => values.includes(row[field])); return query; },
      order(field) { orders.push(field); return query; },
      range(a, b) { start = a; end = Math.min(b + 1, a + cap); return query; },
      abortSignal(signal) {
        if (signal?.aborted) return Promise.resolve({ error: new Error('aborted'), data: null });
        const rows = (tables[table] ?? []).filter(row => conditions.every(condition => condition(row))).slice();
        rows.sort((a, b) => { for (const key of orders) { const result = String(a[key] ?? '').localeCompare(String(b[key] ?? ''), 'pt-BR', { numeric: true }); if (result) return result; } return 0; });
        return Promise.resolve({ data: rows.slice(start, end), error: null });
      },
      insert(payload) { inserts.push({ table, payload }); return Promise.resolve({ error: null }); },
    };
    return query;
  } };
}
const signal = () => new AbortController().signal;
const make = (overrides = {}) => createCatalogGeneration({ id: GENERATION, produtoIds: ['2474'], ...overrides });

test('Contrato distingue completo, filtrado e vazio; IDs bigint permanecem strings', () => {
  assert.equal(make().produtoMode, 'all');
  assert.equal(make({ filtros: { search: 'Frontier' } }).produtoMode, 'filtered');
  assert.equal(make({ produtoIds: [] }).produtoMode, 'empty');
  assert.equal(make({ produtoIds: ['9223372036854775807'] }).produtoIds[0], '9223372036854775807');
  assert.throws(() => make({ produtoIds: [2474] }));
  assert.throws(() => make({ produtoIds: ['9223372036854775808'] }));
  assert.equal(make().incluirFamilias, false);
  assert.deepEqual(make({ familiaIds: [FAMILY] }).familiaIds, []);
});

test('Gerações isoladas por UUID e retomada após login preservam o snapshot', () => {
  const storage = memoryStorage(), session = memoryStorage();
  const first = make({ incluirFamilias: true, familiaIds: [FAMILY], filtros: { search: 'Nissan' } });
  const second = make({ id: '10000000-0000-4000-8000-000000000002', filtros: { brands: ['Outra'] } });
  saveCatalogGeneration(storage, first); saveCatalogGeneration(storage, second);
  session.setItem(PENDING_GENERATION_KEY, first.id);
  assert.deepEqual(readCatalogGeneration(storage, session.getItem(PENDING_GENERATION_KEY)), first);
  assert.deepEqual(readCatalogGeneration(storage, second.id), second);
  assert.equal(generationUrl(first.id), '/catalogo/pdf?generation=' + first.id);
  assert.equal(Object.hasOwn(first.filtros, 'incluirFamilias'), false);
});

test('Ausente, inválido, corrompido e legado vazio nunca viram catálogo completo', () => {
  const storage = memoryStorage();
  assert.throws(() => readPdfGeneration(storage, null));
  storage.setItem('ori_catalogo_ids', '[]'); assert.throws(() => readPdfGeneration(storage, null));
  storage.setItem('ori_catalogo_ids', '[2474]'); assert.equal(readPdfGeneration(storage, null).produtoMode, 'filtered');
  assert.throws(() => readPdfGeneration(storage, GENERATION));
  storage.setItem('ori_catalogo_generation:' + GENERATION, '{'); assert.throws(() => readPdfGeneration(storage, GENERATION));
  assert.throws(() => validateCatalogGeneration({ ...make(), version: 2 }));
  assert.throws(() => validateCatalogGeneration({ ...make(), produtoMode: 'empty' }));
});

test('Elegibilidade compartilhada: Marca/Linha próprias, AND/OR, grupos em produtos diferentes', async () => {
  const client = mockClient(fixtureTables(), 1);
  const data = await loadCatalogFamilies(client, signal());
  const products = fixtureTables().produtos;
  const eligible = filters => relatedFamiliesForFilters(products, data.families, data.links, data.pages, data.familyLines, data.lines, filters);
  for (const filters of [{}, { brands: ['Nissan'] }, { lines: ['Leve'] }, { code: '7701' }, { application: 'Frontier' },
    { brands: ['Outra', 'Nissan'], categories: ['Maçanetas'] }, { categories: ['Fechaduras'], conversion: 'CV2' }]) assert.equal(eligible(filters).length, 1);
  assert.equal(eligible({ brands: ['Outra'] }).length, 0);
  assert.equal(eligible({ brands: ['Nissan'], lines: ['Pesada'] }).length, 0);
  assert.equal(relatedFamiliesForFilters([], data.families, [], data.pages, data.familyLines, data.lines, {}).length, 1);
  assert.equal(client.inserts.length, 0);
});

test('PDF sem Famílias não consulta tabelas editoriais; com Famílias ordena e deduplica páginas', async () => {
  const tables = fixtureTables(), client = mockClient(tables, 1);
  const normal = await loadPdfGeneration(client, make(), signal());
  assert.equal(normal.products.length, 1); assert.deepEqual(normal.familyPages, []);
  assert.ok(client.calls.every(call => call.table === 'produtos'));
  tables.catalogo_familias_paginas.push(tables.catalogo_familias_paginas[1]);
  const withFamilies = await loadPdfGeneration(client, make({ incluirFamilias: true, familiaIds: [FAMILY] }), signal());
  assert.deepEqual(withFamilies.familyPages.map(page => page.id), ['page-0', 'page-2']);
  assert.equal(client.inserts.length, 0);
});

test('Somente Famílias funciona; geração totalmente vazia é rejeitada', async () => {
  const client = mockClient(fixtureTables());
  const result = await loadPdfGeneration(client, make({ produtoIds: [], incluirFamilias: true, familiaIds: [FAMILY] }), signal());
  assert.equal(result.products.length, 0); assert.equal(result.familyPages.length, 2);
  assert.ok(!client.calls.some(call => call.table === 'produtos'));
  await assert.rejects(() => loadPdfGeneration(client, make({ produtoIds: [] }), signal()));
});

test('Publicação ou produtos indisponíveis bloqueiam PDF parcial', async () => {
  const tables = fixtureTables(); tables.catalogo_familias[0].ativo = false;
  await assert.rejects(() => loadPdfGeneration(mockClient(tables), make({ incluirFamilias: true, familiaIds: [FAMILY] }), signal()));
  await assert.rejects(() => loadPdfGeneration(mockClient(fixtureTables()), make({ produtoIds: ['9999'] }), signal()));
});

class ImageMock extends EventTarget {
  constructor({ complete = true, width = 210, decodeError = false } = {}) { super(); this.complete = complete; this.naturalWidth = width; this.decodeError = decodeError; this.decoded = 0; }
  async decode() { this.decoded++; if (this.decodeError) throw new Error('decode'); }
}
const root = images => ({ querySelectorAll: () => images });
test('Impressão aguarda load e decode; erro, timeout e abort bloqueiam', async () => {
  const image = new ImageMock({ complete: false });
  const pending = waitForPdfImages(root([image]), signal(), 1000);
  image.complete = true; image.dispatchEvent(new Event('load')); await pending; assert.equal(image.decoded, 1);
  await assert.rejects(() => waitForPdfImages(root([new ImageMock({ width: 0 })]), signal(), 100));
  await assert.rejects(() => waitForPdfImages(root([new ImageMock({ decodeError: true })]), signal(), 100));
  await assert.rejects(() => waitForPdfImages(root([new ImageMock({ complete: false })]), signal(), 5));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(() => waitForPdfImages(root([new ImageMock()]), controller.signal));
});

test('Lead simulado mantém produtos reais ou []; carregamento/imagens não registram leads', async () => {
  const client = mockClient(fixtureTables());
  const data = await loadPdfGeneration(client, make({ produtoIds: [], incluirFamilias: true, familiaIds: [FAMILY] }), signal());
  assert.equal(client.inserts.length, 0);
  await recordCatalogLead(client, { products: data.products, session: { user: { id: 'user', email: 'fixture@example.invalid' } }, profile: { role: 'cliente' }, region: 'Sudeste' });
  assert.equal(client.inserts.length, 1); assert.deepEqual(client.inserts[0].payload.produtos_selecionados, []);
  assert.equal(client.inserts[0].payload.origem, 'catalogo_pdf');
});

test('Dois pontos de geração usam a mesma função/estado; somente o divisor final permanece', () => {
  const source = fs.readFileSync(new URL('../../src/pages/Catalogo2.jsx', import.meta.url), 'utf8');
  assert.equal((source.match(/className="catalogo2-filter-divider"/g) ?? []).length, 1);
  assert.equal((source.match(/checked=\{incluirFamilias\}/g) ?? []).length, 2);
  assert.equal((source.match(/onClick=\{handleGenerateCatalog\}/g) ?? []).length, 3);
  const savedFilters = source.slice(source.indexOf('function buildFiltrosSnapshot'), source.indexOf('function sameFiltros'));
  assert.equal(savedFilters.includes('incluirFamilias'), false);
  const pdf = fs.readFileSync(new URL('../../src/pages/CatalogoPdf2.jsx', import.meta.url), 'utf8');
  assert.ok(pdf.indexOf('<PdfFamilyPages') < pdf.indexOf('className="pdf-page pdf-back-cover"'));
});