import { productLineFilters, requireTextProductId, readCatalogPages, familyViewerPages, compareFamilies } from './catalogoFamilias.js';

export const PENDING_GENERATION_KEY = 'ori_catalogo_pending_generation';
export const GENERATION_PREFIX = 'ori_catalogo_generation:';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const arrayFields = ['categories', 'lines', 'brands'];
const textFields = ['search', 'application', 'code', 'original', 'conversion', 'barcode', 'sortBy'];

function generationFilters(filters = {}) {
  const result = {};
  for (const field of arrayFields) {
    const value = filters[field] ?? [];
    if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) throw new Error('Filtros de geração inválidos.');
    result[field] = [...value];
  }
  for (const field of textFields) {
    const value = filters[field] ?? '';
    if (typeof value !== 'string') throw new Error('Filtros de geração inválidos.');
    result[field] = value;
  }
  return result;
}

export function createCatalogGeneration({ produtoIds, incluirFamilias = false, familiaIds = [], filtros = {}, id = crypto.randomUUID() }) {
  const snapshot = generationFilters(filtros);
  const filtered = snapshot.categories.length || snapshot.brands.length || productLineFilters(snapshot.lines).length ||
    textFields.filter((field) => field !== 'sortBy').some((field) => snapshot[field].trim());
  return validateCatalogGeneration({ version: 1, id, produtoMode: !produtoIds.length ? 'empty' : filtered ? 'filtered' : 'all',
    produtoIds: [...new Set(produtoIds)], incluirFamilias, familiaIds: incluirFamilias ? [...new Set(familiaIds)] : [], filtros: snapshot });
}

export function validateCatalogGeneration(contract, expectedId) {
  if (!contract || contract.version !== 1 || !UUID.test(contract.id) || (expectedId && contract.id !== expectedId) ||
    !['all', 'filtered', 'empty'].includes(contract.produtoMode) || typeof contract.incluirFamilias !== 'boolean' ||
    !Array.isArray(contract.produtoIds) || !Array.isArray(contract.familiaIds) || !contract.filtros || typeof contract.filtros !== 'object') {
    throw new Error('Solicitação de catálogo ausente ou inválida. Gere novamente no catálogo online.');
  }
  contract.produtoIds.forEach((id) => {
    requireTextProductId(id);
    if (!/^-?(0|[1-9]\d*)$/.test(id) || BigInt(id) < -9223372036854775808n || BigInt(id) > 9223372036854775807n) throw new Error('ID de produto fora do intervalo bigint.');
  });
  if (contract.familiaIds.some((id) => typeof id !== 'string' || !UUID.test(id)) ||
    new Set(contract.produtoIds).size !== contract.produtoIds.length || new Set(contract.familiaIds).size !== contract.familiaIds.length ||
    (contract.produtoMode === 'empty') !== (contract.produtoIds.length === 0) ||
    (!contract.incluirFamilias && contract.familiaIds.length)) throw new Error('Seleção do catálogo inválida.');
  return { ...contract, filtros: generationFilters(contract.filtros) };
}

export function generationUrl(id) { return `/catalogo/pdf?generation=${encodeURIComponent(id)}`; }
export function saveCatalogGeneration(storage, contract) {
  const valid = validateCatalogGeneration(contract);
  storage.setItem(GENERATION_PREFIX + valid.id, JSON.stringify(valid));
}
export function readCatalogGeneration(storage, id) {
  if (!UUID.test(id ?? '')) throw new Error('Identificador de geração ausente ou inválido.');
  let parsed;
  try { parsed = JSON.parse(storage.getItem(GENERATION_PREFIX + id)); }
  catch { throw new Error('Solicitação de catálogo corrompida. Gere novamente.'); }
  return validateCatalogGeneration(parsed, id);
}

export function readPdfGeneration(storage, id) {
  if (id !== null) return readCatalogGeneration(storage, id);
  // Compatibilidade restrita: apenas listas antigas explícitas e não vazias.
  // Nunca interpretar ausência, corrupção ou [] como catálogo completo.
  let ids, brands;
  try { ids = JSON.parse(storage.getItem('ori_catalogo_ids')); brands = JSON.parse(storage.getItem('ori_catalogo_marcas') || '[]'); }
  catch { throw new Error('Solicitação antiga inválida. Gere novamente no catálogo online.'); }
  if (!Array.isArray(ids) || !ids.length || ids.some((value) => typeof value !== 'number' || !Number.isSafeInteger(value))) {
    throw new Error('Nenhuma seleção válida recebida. Gere novamente no catálogo online.');
  }
  const result = createCatalogGeneration({ produtoIds: ids.map(String), filtros: { brands } });
  return { ...result, produtoMode: 'filtered' };
}

export async function loadPdfGeneration(client, contract, signal) {
  validateCatalogGeneration(contract);
  const products = [];
  for (let offset = 0; offset < contract.produtoIds.length; offset += 50) {
    const ids = contract.produtoIds.slice(offset, offset + 50);
    const rows = await readCatalogPages(() => client.from('produtos').select('*,id::text')
      .eq('ativo', true).in('id', ids).order('id'), signal);
    rows.forEach((product) => requireTextProductId(product.id));
    products.push(...rows);
  }
  const uniqueProducts = [...new Map(products.map((product) => [product.id, product])).values()];
  if (uniqueProducts.length !== contract.produtoIds.length) throw new Error('Produtos da seleção ficaram indisponíveis. Atualize a geração no catálogo online.');
  const families = [], pages = [];
  if (contract.incluirFamilias) {
    for (let offset = 0; offset < contract.familiaIds.length; offset += 50) {
      const ids = contract.familiaIds.slice(offset, offset + 50);
      const [nextFamilies, nextPages] = await Promise.all([
        readCatalogPages(() => client.from('catalogo_familias').select('id,nome,marca,ordem,ativo')
          .eq('ativo', true).in('id', ids).order('id'), signal),
        readCatalogPages(() => client.from('catalogo_familias_paginas').select('id,familia_id,imagem_url,titulo,ordem,ativo')
          .eq('ativo', true).in('familia_id', ids).order('familia_id').order('ordem').order('id'), signal),
      ]);
      families.push(...nextFamilies); pages.push(...nextPages);
    }
  }
  const uniqueFamilies = [...new Map(families.map((family) => [family.id, family])).values()].sort(compareFamilies);
  if (uniqueFamilies.length !== contract.familiaIds.length) throw new Error('Uma Família deixou de estar publicada. Atualize a geração no catálogo online.');
  const familyPages = [];
  for (const family of uniqueFamilies) {
    const activePages = familyViewerPages(family.id, pages);
    if (!activePages.length) throw new Error('Uma Família não possui páginas publicáveis. Atualize a geração.');
    familyPages.push(...activePages.map((page) => ({ ...page, familyName: family.nome })));
  }
  if (!uniqueProducts.length && !familyPages.length) throw new Error('Nenhum produto ou página editorial para gerar.');
  return { products: uniqueProducts, familyPages };
}

export async function waitForPdfImages(root, signal, timeoutMs = 30000) {
  if (!root) throw new Error('Pré-visualização indisponível.');

  const images = [...root.querySelectorAll('img')];

  async function verifyImage(img, index) {
    const source = img.currentSrc || img.src || '(sem endereço)';
    const label = `Imagem ${index + 1}/${images.length}`;

    const checkAbort = () => {
      if (signal.aborted) throw new Error('Verificação de imagens cancelada.');
    };

    async function waitForLoad() {
      checkAbort();

      if (img.complete) {
        if (!img.naturalWidth) throw new Error('Imagem indisponível.');
        return;
      }

      await new Promise((resolve, reject) => {
        let finished = false;
        let timer;

        const cleanup = () => {
          clearTimeout(timer);
          img.removeEventListener('load', loaded);
          img.removeEventListener('error', failed);
          signal.removeEventListener('abort', aborted);
        };

        const finish = (error) => {
          if (finished) return;
          finished = true;
          cleanup();
          if (error) reject(error);
          else resolve();
        };

        const loaded = () => finish(img.naturalWidth ? null : new Error('Imagem indisponível.'));
        const failed = () => finish(new Error('Falha no carregamento.'));
        const aborted = () => finish(new Error('Verificação cancelada.'));

        timer = setTimeout(
          () => finish(new Error('Tempo de carregamento excedido.')),
          timeoutMs
        );

        img.addEventListener('load', loaded);
        img.addEventListener('error', failed);
        signal.addEventListener('abort', aborted, { once: true });

        if (signal.aborted) aborted();
        else if (img.complete) loaded();
      });
    }

    async function waitForDecode() {
      if (typeof img.decode !== 'function') return;
      checkAbort();

      await new Promise((resolve, reject) => {
        let finished = false;
        let timer;

        const cleanup = () => {
          clearTimeout(timer);
          signal.removeEventListener('abort', aborted);
        };

        const finish = (error) => {
          if (finished) return;
          finished = true;
          cleanup();
          if (error) reject(error);
          else resolve();
        };

        const aborted = () => finish(new Error('Verificação cancelada.'));

        timer = setTimeout(
          () => finish(new Error('Tempo de decodificação excedido.')),
          timeoutMs
        );

        signal.addEventListener('abort', aborted, { once: true });

        if (signal.aborted) {
          aborted();
          return;
        }

        Promise.resolve()
          .then(() => img.decode())
          .then(() => finish(), (error) => finish(error));
      });
    }

    try {
      await waitForLoad();
      await waitForDecode();
      checkAbort();
    } catch (error) {
      if (signal.aborted) throw error;
      console.warn('ORI PDF: falha ao verificar imagem', {
        index: index + 1,
        source,
        message: error.message,
      });
      throw new Error(`${label}: ${error.message}. Verifique a imagem e tente novamente.`);
    }
  }

  const concurrency = Math.min(8, images.length);
  let nextIndex = 0;
  let firstError = null;

  async function worker() {
    while (nextIndex < images.length && !firstError && !signal.aborted) {
      const index = nextIndex++;
      try {
        await verifyImage(images[index], index);
      } catch (error) {
        if (!firstError) firstError = error;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  if (firstError) throw firstError;
  if (signal.aborted) throw new Error('Verificação de imagens cancelada.');
}
export async function recordCatalogLead(client, { products, session, profile, region }) {
  return client.from('leads').insert({
    nome: profile?.nome || session.user.email, email: session.user.email,
    vendedor_id: profile?.role === 'vendedor' ? session.user.id : null,
    produtos_selecionados: products.map((p) => ({ id: p.id, codigo: p.codigo, descricao: p.descricao })),
    origem: 'catalogo_pdf', regiao: region || null,
  });
}