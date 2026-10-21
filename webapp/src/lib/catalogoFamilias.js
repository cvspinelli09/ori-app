export function isFamiliesOption(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLocaleUpperCase('pt-BR') === 'FAMILIAS';
}

export function productLineFilters(lines = []) {
  return lines.filter((line) => !isFamiliesOption(line));
}

export function requireTextProductId(id) {
  if (typeof id !== 'string' || !/^-?\d+$/.test(id)) {
    throw new Error('ID de produto inválido: a API deve retornar texto.');
  }
  return id;
}

export async function readCatalogPages(makeQuery, signal) {
  const rows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await makeQuery().range(offset, offset + 499).abortSignal(signal);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('Resposta de catálogo inválida.');
    if (!data.length) return rows;
    rows.push(...data);
    offset += data.length;
  }
}

function matchesEditorialApplication(product, query) {
  const applications = Array.isArray(product.aplicacoes) ? product.aplicacoes : [];
  return applications.some((application) =>
    [application.veiculo, application.geracao, application.portas, application.ano_apos,
      application.ate, application.obs].some((value) => normalize(value).includes(query)));
}

export function relatedFamiliesForFilters(products, families, links, pages, familyLines, lines, filters = {}) {
  const productsById = new Map(products.filter((product) => product.ativo === true)
    .map((product) => [requireTextProductId(product.id), product]));
  const productsByFamily = new Map();
  links.forEach((link) => {
    const product = productsById.get(requireTextProductId(link.produto_id));
    if (!product) return;
    const current = productsByFamily.get(link.familia_id) ?? [];
    current.push(product);
    productsByFamily.set(link.familia_id, current);
  });
  const lineNamesById = new Map(lines.filter((line) => line.ativo === true).map((line) => [line.id, line.nome]));
  const linesByFamily = new Map();
  familyLines.forEach((link) => {
    const name = lineNamesById.get(link.linha_id);
    if (!name) return;
    const current = linesByFamily.get(link.familia_id) ?? [];
    current.push(name);
    linesByFamily.set(link.familia_id, current);
  });
  const productLines = productLineFilters(filters.lines);
  const codeFilters = [['code', 'codigo'], ['original', 'original'],
    ['conversion', 'numero_conversao'], ['barcode', 'barras']];
  const covers = new Map();
  [...pages].filter((page) => page.ativo === true && page.imagem_url)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.id.localeCompare(b.id))
    .forEach((page) => { if (!covers.has(page.familia_id)) covers.set(page.familia_id, page); });

  const eligible = families.filter((family) => {
    if (family.ativo !== true || !covers.has(family.id)) return false;
    const linkedProducts = productsByFamily.get(family.id) ?? [];
    if (filters.brands?.length && !filters.brands.includes(family.marca)) return false;
    if (productLines.length && !(linesByFamily.get(family.id) ?? []).some((name) => productLines.includes(name))) return false;
    if (filters.categories?.length && !linkedProducts.some((product) => filters.categories.includes(product.categoria))) return false;
    if (filters.application?.trim() && !linkedProducts.some((product) => matchesEditorialApplication(product, normalize(filters.application)))) return false;
    // Cada grupo pode corresponder a um produto vinculado diferente.
    if (!codeFilters.every(([filter, field]) => !filters[filter]?.trim() ||
      linkedProducts.some((product) => normalizeCode(product[field]).includes(normalizeCode(filters[filter]))))) return false;
    if (filters.search?.trim()) {
      const query = normalize(filters.search);
      const ownMatch = [family.nome, family.marca, family.veiculo, family.anos]
        .some((value) => normalize(value).includes(query));
      const productMatch = linkedProducts.some((product) => matchesSearch(product, filters.search) ||
        [product.numero_conversao, product.barras, ...(Array.isArray(product.marcas) ? product.marcas : [])]
          .some((value) => normalize(value).includes(query)) || matchesEditorialApplication(product, query));
      if (!ownMatch && !productMatch) return false;
    }
    return true;
  });
  return [...new Map(eligible.map((family) => [family.id, { ...family, cover: covers.get(family.id) }])).values()]
    .sort((a, b) => (a.marca || '').localeCompare(b.marca || '', 'pt-BR') ||
      (a.ordem ?? 0) - (b.ordem ?? 0) || a.nome.localeCompare(b.nome, 'pt-BR') || a.id.localeCompare(b.id));
}
export function normalize(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function normalizeCode(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function matchesSearch(p, query) {
  if (!query) return true;

  const q = normalize(query);

  return (
    normalize(p.descricao).includes(q) ||
    normalize(p.codigo).includes(q) ||
    normalize(p.original).includes(q) ||
    normalize(p.veiculos).includes(q) ||
    normalize(p.marca).includes(q)
  );
}

export function familyViewerPages(familyId, pages) {
  return [...new Map(pages.filter((page) => page.familia_id === familyId && page.ativo === true && page.imagem_url)
    .map((page) => [page.id, page])).values()]
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.id.localeCompare(b.id));
}


export function compareFamilies(a, b) {
  return (a.marca || '').localeCompare(b.marca || '', 'pt-BR') ||
    (a.ordem ?? 0) - (b.ordem ?? 0) || a.nome.localeCompare(b.nome, 'pt-BR') || a.id.localeCompare(b.id);
}

export async function loadCatalogFamilies(client, signal) {
  const families = await readCatalogPages(() => client.from('catalogo_familias')
    .select('id,nome,marca,veiculo,anos,ordem,ativo').eq('ativo', true).order('id'), signal);
  const lines = await readCatalogPages(() => client.from('catalogo_linhas')
    .select('id,nome,ativo').eq('ativo', true).order('id'), signal);
  const pages = [], links = [], familyLines = [];
  for (let offset = 0; offset < families.length; offset += 50) {
    const ids = families.slice(offset, offset + 50).map((family) => family.id);
    const [nextPages, nextLinks, nextFamilyLines] = await Promise.all([
      readCatalogPages(() => client.from('catalogo_familias_paginas')
        .select('id,familia_id,imagem_url,titulo,ordem,ativo').eq('ativo', true)
        .in('familia_id', ids).order('familia_id').order('ordem').order('id'), signal),
      readCatalogPages(() => client.from('catalogo_familias_produtos')
        .select('familia_id,produto_id::text').in('familia_id', ids)
        .order('familia_id').order('produto_id'), signal),
      readCatalogPages(() => client.from('catalogo_familias_linhas')
        .select('familia_id,linha_id').in('familia_id', ids)
        .order('familia_id').order('linha_id'), signal),
    ]);
    nextLinks.forEach((link) => requireTextProductId(link.produto_id));
    pages.push(...nextPages); links.push(...nextLinks); familyLines.push(...nextFamilyLines);
  }
  return { families, lines, pages, links, familyLines };
}