import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';

const PERIOD_CONFIG = {
  '30d': { days: 30 },
  '90d': { days: 90 },
  '6m': { months: 6 },
  '12m': { months: 12 },
};

function getPeriodStart(period) {
  const config = PERIOD_CONFIG[period];

  if (!config) return null;

  const start = new Date();

  if (config.days) {
    start.setDate(start.getDate() - config.days);
  }

  if (config.months) {
    start.setMonth(start.getMonth() - config.months);
  }

  return start.toISOString();
}

function normalizeSelectedProduct(item) {
  if (item === null || item === undefined) return null;

  if (typeof item === 'object') {
    const id =
      item.id ??
      item.produto_id ??
      item.product_id ??
      null;

    const codigo =
      item.codigo ??
      item.code ??
      null;

    const key =
      id !== null
        ? `id:${id}`
        : codigo
          ? `codigo:${codigo}`
          : null;

    if (!key) return null;

    return {
      key,
      id,
      codigo: codigo ? String(codigo) : null,
      descricao:
        item.descricao ??
        item.description ??
        null,
    };
  }

  const value = String(item).trim();

  if (!value) return null;

  return {
    key: `valor:${value}`,
    id: null,
    codigo: value,
    descricao: null,
  };
}

function formatRankingProductDescription(value) {
  const text = String(value || '').trim();

  if (!text) return '';

  const separatorIndex = text.indexOf(' - ');

  if (separatorIndex !== -1) {
    return `${text.slice(0, separatorIndex).trim()}...`;
  }

  return text.length > 52
    ? `${text.slice(0, 52).trim()}...`
    : text;
}

export function TopProducts({ period = '30d' }) {
  const [productRows, setProductRows] = useState([]);
  const [categoryRows, setCategoryRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [allProductRows, setAllProductRows] = useState([]);
  const [allCategoryRows, setAllCategoryRows] = useState([]);
  const [rankingOpen, setRankingOpen] = useState(false);
  const [rankingTab, setRankingTab] = useState('categories');
  const [rankingSearch, setRankingSearch] = useState(''); 

  const periodStart = useMemo(
    () => getPeriodStart(period),
    [period]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadInterestRanking() {
      if (!periodStart) {
        setProductRows([]);
        setCategoryRows([]);
        setAllProductRows([]);
        setAllCategoryRows([]);
        setLoading(false);
        setError('');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const now = new Date().toISOString();

        const { data: leads, error: leadsError } =
          await supabase
            .from('leads')
            .select('id, produtos_selecionados, created_at')
            .gte('created_at', periodStart)
            .lte('created_at', now);

        if (leadsError) {
          throw leadsError;
        }

        const productsByLead = [];
        const uniqueIds = new Set();
        const uniqueCodes = new Set();

        for (const lead of leads ?? []) {
          const rawProducts =
            Array.isArray(lead.produtos_selecionados)
              ? lead.produtos_selecionados
              : [];

          const uniqueProducts = new Map();

          for (const item of rawProducts) {
            const product = normalizeSelectedProduct(item);

            if (!product) continue;

            uniqueProducts.set(product.key, product);

            if (product.id !== null) {
              uniqueIds.add(product.id);
            } else if (product.codigo) {
              uniqueCodes.add(product.codigo);
            }
          }

          productsByLead.push(
            [...uniqueProducts.values()]
          );
        }

        const [productsByIdResult, productsByCodeResult] =
          await Promise.all([
            uniqueIds.size
              ? supabase
                  .from('produtos')
                  .select(
                    'id, codigo, descricao, categoria'
                  )
                  .in('id', [...uniqueIds])
              : Promise.resolve({
                  data: [],
                  error: null,
                }),

            uniqueCodes.size
              ? supabase
                  .from('produtos')
                  .select(
                    'id, codigo, descricao, categoria'
                  )
                  .in('codigo', [...uniqueCodes])
              : Promise.resolve({
                  data: [],
                  error: null,
                }),
          ]);

        if (productsByIdResult.error) {
          throw productsByIdResult.error;
        }

        if (productsByCodeResult.error) {
          throw productsByCodeResult.error;
        }

        const catalogById = new Map(
          (productsByIdResult.data ?? []).map(
            (product) => [
              String(product.id),
              product,
            ]
          )
        );

        const catalogByCode = new Map(
          (productsByCodeResult.data ?? []).map(
            (product) => [
              String(product.codigo),
              product,
            ]
          )
        );

        const productRanking = new Map();
        const categoryRanking = new Map();

        for (const leadProducts of productsByLead) {
          const categoriesInThisLead = new Set();

          for (const product of leadProducts) {
            const catalogProduct =
              product.id !== null
                ? catalogById.get(String(product.id))
                : catalogByCode.get(
                    String(product.codigo)
                  );

            const codigo =
              catalogProduct?.codigo ??
              product.codigo ??
              '—';

            const descricao =
              catalogProduct?.descricao ??
              product.descricao ??
              'Produto';

            const categoria =
              catalogProduct?.categoria ??
              'Sem categoria';

            const productKey =
              catalogProduct?.id !== undefined
                ? `id:${catalogProduct.id}`
                : `codigo:${codigo}`;

            const currentProduct =
              productRanking.get(productKey);

            if (currentProduct) {
              currentProduct.count += 1;
            } else {
              productRanking.set(productKey, {
                key: productKey,
                codigo,
                descricao,
                count: 1,
              });
            }

            categoriesInThisLead.add(categoria);
          }

          for (const categoria of categoriesInThisLead) {
            categoryRanking.set(
              categoria,
              (categoryRanking.get(categoria) ?? 0) + 1
            );
          }
        }

        const fullProducts = [...productRanking.values()]
            .sort(
                (a, b) =>
                b.count - a.count ||
                String(a.codigo).localeCompare(
                    String(b.codigo),
                    'pt-BR'
                )
            );

            const fullCategories = [...categoryRanking.entries()]
            .map(([categoria, count]) => ({
                categoria,
                count,
            }))
            .sort(
                (a, b) =>
                b.count - a.count ||
                a.categoria.localeCompare(
                    b.categoria,
                    'pt-BR'
                )
            );

        const nextProducts = fullProducts.slice(0, 5);
        const nextCategories = fullCategories.slice(0, 5);

        if (!cancelled) {
            setProductRows(nextProducts);
            setCategoryRows(nextCategories);

            setAllProductRows(fullProducts);
            setAllCategoryRows(fullCategories);
        }
      } catch (err) {
        console.error(
          'Erro ao carregar produtos e categorias de maior interesse:',
          err
        );

        if (!cancelled) {
          setProductRows([]);
          setCategoryRows([]);
          setError(
            'Não foi possível carregar os produtos de maior interesse.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadInterestRanking();

    return () => {
      cancelled = true;
    };
  }, [periodStart]);

  const maxProductCount = Math.max(
    ...productRows.map((row) => row.count),
    1
  );

  const maxCategoryCount = Math.max(
    ...categoryRows.map((row) => row.count),
    1
  );

  const normalizedRankingSearch = rankingSearch
  .trim()
  .toLocaleLowerCase('pt-BR');

const filteredCategoryRows = allCategoryRows.filter(
  (category) =>
    !normalizedRankingSearch ||
    category.categoria
      .toLocaleLowerCase('pt-BR')
      .includes(normalizedRankingSearch)
);

const filteredProductRows = allProductRows.filter(
  (product) => {
    if (!normalizedRankingSearch) return true;

    const codigo = String(
      product.codigo || ''
    ).toLocaleLowerCase('pt-BR');

    const descricao = String(
      product.descricao || ''
    ).toLocaleLowerCase('pt-BR');

    return (
      codigo.includes(normalizedRankingSearch) ||
      descricao.includes(normalizedRankingSearch)
    );
  }
);

  return (
    <>
    <section className="admin2-overview-block admin2-top-products">
      <div className="admin2-overview-block-heading">
        <div>
          <h2>Produtos de maior interesse</h2>
          <p>
            Produtos e categorias mais presentes nos leads gerados.
          </p>
        </div>
      </div>

      {period === 'custom' ? (
        <div className="admin2-top-products-empty">
          Defina o período personalizado para visualizar os dados.
        </div>
      ) : error ? (
        <div className="admin2-form-error">
          {error}
        </div>
      ) : loading ? (
        <div className="admin2-top-products-empty">
          Carregando produtos...
        </div>
      ) : productRows.length === 0 &&
        categoryRows.length === 0 ? (
        <div className="admin2-top-products-empty">
          Nenhum produto associado aos leads deste período.
        </div>
            ) : (
        <>
          <div className="admin2-interest-columns">
            <div className="admin2-interest-column">
              <div className="admin2-interest-column-title">
                Categorias
              </div>

              {categoryRows.map((category, index) => (
                <div
                  className="admin2-interest-row"
                  key={category.categoria}
                >
                  <span className="admin2-interest-position">
                    {index + 1}
                  </span>

                  <div className="admin2-interest-info">
                    <div className="admin2-interest-title">
                      <strong title={category.categoria}>
                        {category.categoria}
                      </strong>

                      <span>
                        {category.count.toLocaleString('pt-BR')}
                      </span>
                    </div>

                    <div className="admin2-interest-description is-empty">
                      &nbsp;
                    </div>

                    <div className="admin2-interest-bar">
                      <span
                        style={{
                          width: `${
                            (category.count / maxCategoryCount) * 100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="admin2-interest-column">
              <div className="admin2-interest-column-title">
                Produtos
              </div>

              {productRows.map((product, index) => (
                <div
                  className="admin2-interest-row"
                  key={product.key}
                >
                  <span className="admin2-interest-position">
                    {index + 1}
                  </span>

                  <div className="admin2-interest-info">
                    <div className="admin2-interest-title">
                      <strong title={`Cód. ${product.codigo}`}>
                        Cód. {product.codigo}
                      </strong>

                      <span>
                        {product.count.toLocaleString('pt-BR')}
                      </span>
                    </div>

                    <div
                        className="admin2-interest-description"
                        title={product.descricao}
                        >
                        {formatRankingProductDescription(product.descricao)}
                    </div>

                    <div className="admin2-interest-bar">
                      <span
                        style={{
                          width: `${
                            (product.count / maxProductCount) * 100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="admin2-interest-ranking-button"
            onClick={() => setRankingOpen(true)}
            >
            Ver ranking completo →
          </button>
        </>
      )}
      
    </section>

    {rankingOpen && (
        <div
            className="admin2-ranking-overlay"
            onClick={() => setRankingOpen(false)}
        >
            <aside
            className="admin2-ranking-drawer"
            onClick={(event) => event.stopPropagation()}
            >
            <div className="admin2-ranking-drawer-header">
                <div>
                <h2>Ranking completo de interesse</h2>
                <p>
                    Produtos e categorias presentes nos leads do período selecionado.
                </p>
                </div>

                <button
                type="button"
                className="admin2-ranking-close"
                onClick={() => setRankingOpen(false)}
                aria-label="Fechar ranking"
                >
                ×
                </button>
            </div>

            <div className="admin2-ranking-summary">
                <span>
                    <strong>{allCategoryRows.length}</strong>{' '}
                    categorias
                </span>

                <span>
                    <strong>{allProductRows.length}</strong>{' '}
                    produtos
                </span>
                </div>

                <div className="admin2-ranking-tabs">
                <button
                    type="button"
                    className={
                    rankingTab === 'categories'
                        ? 'is-active'
                        : ''
                    }
                    onClick={() => {
                    setRankingTab('categories');
                    setRankingSearch('');
                    }}
                >
                    Categorias
                </button>

                <button
                    type="button"
                    className={
                    rankingTab === 'products'
                        ? 'is-active'
                        : ''
                    }
                    onClick={() => {
                    setRankingTab('products');
                    setRankingSearch('');
                    }}
                >
                    Produtos
                </button>
                </div>

                <div className="admin2-ranking-search">
                <input
                    type="search"
                    value={rankingSearch}
                    onChange={(event) =>
                    setRankingSearch(event.target.value)
                    }
                    placeholder={
                    rankingTab === 'categories'
                        ? 'Buscar categoria...'
                        : 'Buscar por código ou descrição...'
                    }
                />
                </div>

                <div className="admin2-ranking-list">
                {rankingTab === 'categories' ? (
                    filteredCategoryRows.length === 0 ? (
                    <div className="admin2-ranking-empty">
                        Nenhuma categoria encontrada.
                    </div>
                    ) : (
                    filteredCategoryRows.map((category) => {
                        const originalPosition =
                        allCategoryRows.findIndex(
                            (item) =>
                            item.categoria === category.categoria
                        ) + 1;

                        return (
                        <div
                            className="admin2-ranking-list-row"
                            key={category.categoria}
                        >
                            <span className="admin2-ranking-position">
                            {originalPosition}
                            </span>

                            <div className="admin2-ranking-list-content">
                            <strong>
                                {category.categoria}
                            </strong>
                            </div>

                            <span className="admin2-ranking-count">
                            {category.count.toLocaleString(
                                'pt-BR'
                            )}
                            </span>
                        </div>
                        );
                    })
                    )
                ) : filteredProductRows.length === 0 ? (
                    <div className="admin2-ranking-empty">
                    Nenhum produto encontrado.
                    </div>
                ) : (
                    filteredProductRows.map((product) => {
                    const originalPosition =
                        allProductRows.findIndex(
                        (item) => item.key === product.key
                        ) + 1;

                    return (
                        <div
                        className="admin2-ranking-list-row"
                        key={product.key}
                        >
                        <span className="admin2-ranking-position">
                            {originalPosition}
                        </span>

                        <div className="admin2-ranking-list-content">
                            <strong>
                            Cód. {product.codigo}
                            </strong>

                            <span title={product.descricao}>
                            {product.descricao}
                            </span>
                        </div>

                        <span className="admin2-ranking-count">
                            {product.count.toLocaleString(
                            'pt-BR'
                            )}
                        </span>
                        </div>
                    );
                    })
                )}
                </div>
            </aside>
        </div>
    )}
  </>
);
}