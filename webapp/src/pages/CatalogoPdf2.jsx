import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import '../styles/catalogo-pdf2.css';

const LINHA_ORDER = ['Leve', 'Van', 'Pesada'];

function getLinhasOf(p) {
  return (p.linha || '').split(',').map((s) => s.trim()).filter(Boolean);
}

function getLinhaGroups(picks) {
  const groups = LINHA_ORDER
    .map((linha) => [linha, picks.filter((p) => getLinhasOf(p).includes(linha))])
    .filter(([, arr]) => arr.length > 0);

  const known = new Set(LINHA_ORDER);
  const extras = [...new Set(picks.flatMap(getLinhasOf).filter((l) => !known.has(l)))];
  extras.forEach((linha) => {
    groups.push([linha, picks.filter((p) => getLinhasOf(p).includes(linha))]);
  });

  return groups;
}

function groupPreservingOrder(list, keyFn) {
  const order = [];
  const map = new Map();
  list.forEach((item) => {
    const key = keyFn(item);
    if (!map.has(key)) { map.set(key, []); order.push(key); }
    map.get(key).push(item);
  });
  return order.map((key) => [key, map.get(key)]);
}

function buildLinhaItems(linhaPicks) {
  const items = [];

  const marcaGroups = groupPreservingOrder(
    linhaPicks,
    (p) => p.marca || 'Outras'
  );

  marcaGroups.forEach(([marca, marcaPicks]) => {
  items.push({
    type: 'brand',
    text: marca,
    brand: marca,
  });

  const categoriaGroups = groupPreservingOrder(
    marcaPicks,
    (p) => p.categoria || 'Diversos'
  );

  categoriaGroups.forEach(([categoria, categoriaPicks]) => {
    items.push({
      type: 'category',
      text: categoria,
      brand: marca,
    });

    categoriaPicks.forEach((produto) => {
      items.push({
        type: 'card',
        product: produto,
        brand: marca,
      });
    });
  });
});

  return items;
}



function linhaHeaderClass(linha) {
  const key = (linha || '').trim().toLowerCase();
  if (key === 'leve') return 'linha-leve';
  if (key === 'van') return 'linha-van';
  if (key === 'pesada') return 'linha-pesada';
  return '';
}

function linhaBannerSrc(linha) {
  const key = String(linha || '').trim().toLowerCase();

  if (key === 'van') {
    return '/assets/catalogo/linhas/linha-van.png';
  }

  if (key === 'pesada') {
    return '/assets/catalogo/linhas/linha-pesada.png';
  }

  return '/assets/catalogo/linhas/linha-leve.png';
}

function formatAplicacoes(aplicacoes) {
  if (!Array.isArray(aplicacoes) || aplicacoes.length === 0) {
    return '';
  }

  return aplicacoes
    .map((app) => {
      const veiculo = [app.veiculo, app.geracao]
        .filter(Boolean)
        .join(' ')
        .trim();

      let periodo = '';

      if (app.ano_apos && app.ate) {
        periodo = `${app.ano_apos} a ${app.ate}`;
      } else if (app.ano_apos) {
        periodo = `após ${app.ano_apos}`;
      } else if (app.ate) {
        periodo = `até ${app.ate}`;
      }

      return [veiculo, periodo]
        .filter(Boolean)
        .join(' ')
        .trim();
    })
    .filter(Boolean)
    .join(' / ');
}

function normalizeProductTitle(value) {
  const text = String(value || '').trim();

  if (!text) return '';

  const letters = text.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '');

  if (letters && letters === letters.toUpperCase()) {
    const lower = text.toLocaleLowerCase('pt-BR');

    return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1);
  }

  return text;
}

function getProductTitle(produto) {
  const descricao = String(produto.descricao || '').trim();
  const aplicacoes = Array.isArray(produto.aplicacoes) ? produto.aplicacoes : [];

  if (!descricao) {
    return '';
  }

  let titulo = descricao;

  if (aplicacoes.length > 0) {
    const separatorIndex = descricao.indexOf(' - ');

    if (separatorIndex !== -1) {
      const before = descricao.slice(0, separatorIndex).trim();
      const after = descricao.slice(separatorIndex + 3).toLowerCase();

      const hasApplicationVehicle = aplicacoes.some((app) => {
        const veiculo = String(app.veiculo || '').trim().toLowerCase();
        return veiculo && after.includes(veiculo);
      });

      if (hasApplicationVehicle) {
        titulo = before;
      }
    }
  }

  return normalizeProductTitle(titulo);
}

function formatConversao(value) {
  const raw = String(value ?? '').trim();

  if (!raw) return 'N/D';

  const normalized = raw
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/\./g, '');

  if (
    normalized === 'nd' ||
    normalized === 'n/d' ||
    normalized === 'na' ||
    normalized === 'n/a' ||
    normalized === '-' ||
    normalized === '--'
  ) {
    return 'N/D';
  }

  return raw;
}

function ProductCard({ p }) {
  const aplicacao = formatAplicacoes(p.aplicacoes);
  const titulo = getProductTitle(p);

  return (
    <div className="pdf-catalog-card">
      <div className="photo">
        <img src={p.foto_local} alt="" />
      </div>

      <div className="text">
        <div className="suitable">Suitable to</div>

        <div className="code">
          Cód. {p.codigo}
          <span className="conv">
            {' '}• Conv. {formatConversao(p.numero_conversao)}
          </span>
        </div>

        <div className="name" title={titulo}>{titulo}</div>

        {aplicacao && (
          <div className="app">{aplicacao}</div>
        )}
      </div>
    </div>
  );
}

function itemHtmlFor(item, key) {
  if (item.type === 'brand') {
    return (
      <div
        className={`pdf-brand-banner${item.continuation ? ' is-continuation' : ''}`}
        key={key}
      >
        {item.text}
      </div>
    );
  }

  if (item.type === 'category') {
    return (
      <div className="pdf-category-banner" key={key}>
        {item.text}
      </div>
    );
  }

  return <ProductCard p={item.product} key={key} />;
}

function getMacroRegionFromState(state) {
  const value = String(state || '')
    .trim()
    .toLocaleLowerCase('pt-BR');

  const southeast = [
    'são paulo',
    'sao paulo',
    'rio de janeiro',
    'minas gerais',
    'espírito santo',
    'espirito santo',
    'sp',
    'rj',
    'mg',
    'es',
  ];

  const south = [
    'paraná',
    'parana',
    'santa catarina',
    'rio grande do sul',
    'pr',
    'sc',
    'rs',
  ];

  const northeast = [
    'bahia',
    'pernambuco',
    'ceará',
    'ceara',
    'maranhão',
    'maranhao',
    'paraíba',
    'paraiba',
    'rio grande do norte',
    'alagoas',
    'sergipe',
    'piauí',
    'piaui',
    'ba',
    'pe',
    'ce',
    'ma',
    'pb',
    'rn',
    'al',
    'se',
    'pi',
  ];

  const midwest = [
    'goiás',
    'goias',
    'mato grosso',
    'mato grosso do sul',
    'distrito federal',
    'go',
    'mt',
    'ms',
    'df',
  ];

  const north = [
    'amazonas',
    'pará',
    'para',
    'acre',
    'rondônia',
    'rondonia',
    'roraima',
    'amapá',
    'amapa',
    'tocantins',
    'am',
    'pa',
    'ac',
    'ro',
    'rr',
    'ap',
    'to',
  ];

  if (southeast.includes(value)) return 'Sudeste';
  if (south.includes(value)) return 'Sul';
  if (northeast.includes(value)) return 'Nordeste';
  if (midwest.includes(value)) return 'Centro-Oeste';
  if (north.includes(value)) return 'Norte';

  return '';
}

export function CatalogoPdf2() {
  const navigate = useNavigate();
  const { session, profile, loading: authLoading } = useAuth();
  const [pages, setPages] = useState(null);
  const [regiao, setRegiao] = useState('');
  const regiaoTouched = useRef(false);
  const leadRegisteredRef = useRef(false);
  const measureRef = useRef(null);
  const pagesWrapRef = useRef(null);
  const pagesElRef = useRef(null);

  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then((r) => r.json())
      .then((data) => {
        if (regiaoTouched.current || data.error) return;

        const macroRegion = getMacroRegionFromState(
          data.region_code || data.region
        );

        if (macroRegion) {
          setRegiao(macroRegion);
        }
      })
      .catch(() => {
        /* estimativa de região é só conveniência, falha silenciosa */
      });
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      navigate('/login');
      return;
    }

    let cancelled = false;

    async function run() {
      let ids = [];
      try { ids = JSON.parse(localStorage.getItem('ori_catalogo_ids') || '[]'); } catch { /* ignore */ }

      // busca o catálogo inteiro e filtra no cliente -- evita mandar uma lista enorme
      // de ids pro Supabase via query string (poderia passar do limite de URL).
      const { data, error } = await supabase.from('produtos').select('*').eq('ativo', true).limit(5000);
      if (error) { console.error(error); return; }
      if (cancelled) return;

      const idSet = new Set(ids);
      const base = ids.length > 0 ? (data ?? []).filter((p) => idSet.has(p.id)) : (data ?? []);
      const picks = base.slice().sort((a, b) =>
        (a.marca || '').localeCompare(b.marca || '') ||
        (a.categoria || '').localeCompare(b.categoria || '') ||
        parseInt(a.codigo, 10) - parseInt(b.codigo, 10)
      );

      if (document.fonts && document.fonts.ready) {
        try { await document.fonts.ready; } catch { /* ignore */ }
      }
      if (cancelled) return;

      const measure = createMeasurer();
      let pageNum = 1;
      const builtPages = [];

      getLinhaGroups(picks).forEach(([linha, linhaPicks]) => {
        measure.setHeader(linha);

        const items = buildLinhaItems(linhaPicks);
        const chunks = paginateByHeight(items, measure);

        chunks.forEach((chunk) => {
          builtPages.push({
            linha,
            chunk,
            pageNum,
          });

          pageNum++;
        });
      });

      measure.cleanup();

      if (!cancelled) {
        setPages({
          picks,
          builtPages,
          today: new Date().toLocaleDateString('pt-br'),
          isFullCatalog: ids.length === 0,
        });

        if (!leadRegisteredRef.current) {
          leadRegisteredRef.current = true;

          let detectedRegion = regiao.trim();

          if (!detectedRegion) {
            try {
              const response = await fetch('https://ipapi.co/json/');
              const locationData = await response.json();

              if (!locationData.error) {
                detectedRegion = getMacroRegionFromState(
                  locationData.region_code || locationData.region
                );
              }
            } catch {
              // Localização é auxiliar e não deve impedir o registro do lead.
            }
          }

          const { error: leadError } = await supabase
            .from('leads')
            .insert({
              nome: profile?.nome || session.user.email,
              email: session.user.email,

              vendedor_id:
                profile?.role === 'vendedor'
                  ? session.user.id
                  : null,

              produtos_selecionados: picks.map((p) => ({
                id: p.id,
                codigo: p.codigo,
                descricao: p.descricao,
              })),

              origem: 'catalogo_pdf',
              regiao: detectedRegion || null,
            });

          if (leadError) {
            console.error(
              'Erro ao registrar geração de catálogo:',
              leadError
            );
          }
        }
      }
    } 
    run();
    return () => { cancelled = true; };
  }, [authLoading, session, navigate]);

  useEffect(() => {
    function fitPagesToScreen() {
      const wrap = pagesWrapRef.current;
      const pagesEl = pagesElRef.current;
      if (!wrap || !pagesEl || !pagesEl.querySelector('.pdf-page')) return;

      const naturalWidth = (210 * 96) / 25.4;
      const sideMargin = 16;
      const availableWidth = window.innerWidth - sideMargin * 2;

      if (availableWidth < naturalWidth) {
        const scale = availableWidth / naturalWidth;
        pagesEl.style.transform = `scale(${scale})`;
        pagesEl.style.marginLeft = `${sideMargin}px`;
        wrap.style.height = `${pagesEl.getBoundingClientRect().height}px`;
      } else {
        pagesEl.style.transform = '';
        pagesEl.style.marginLeft = '';
        wrap.style.height = '';
      }
    }
    fitPagesToScreen();
    window.addEventListener('resize', fitPagesToScreen);
    return () => window.removeEventListener('resize', fitPagesToScreen);
  }, [pages]);

  function handlePrint() {
    window.print();
  }

  if (!pages) {
    return <div className="pdfpage-root"><p style={{ padding: 24 }}>Montando catálogo...</p></div>;
  }

  const countLabel = pages.isFullCatalog
  ? `${pages.picks.length} peças — catálogo completo`
  : `${pages.picks.length} peças selecionadas`;

  const responsavelNome =
    profile?.nome ||
    session?.user?.user_metadata?.full_name ||
    'Equipe Ori';

  const responsavelEmail =
    session?.user?.email ||
    '';

  const responsavelTelefone =
    profile?.telefone ||
    '(11) 2542-5110';

  return (
    <div className="pdfpage-root" ref={measureRef}>
      <div className="pdf-toolbar">
        <span>Pré-visualização do catálogo — na janela de impressão, use margens "Nenhuma" e marque "Imprimir gráficos de segundo plano"</span>
        <input
          type="text"
          className="pdf-regiao-input"
          placeholder="Região"
          value={regiao}
          onChange={(e) => { regiaoTouched.current = true; setRegiao(e.target.value); }}
          title="Região estimada automaticamente. Edite se necessário."
        />
        <button onClick={handlePrint}>Imprimir / Salvar PDF</button>
      </div>

      <div id="pdfPagesWrap" ref={pagesWrapRef}>
        <div id="pdfPages" ref={pagesElRef}>
          <div className="pdf-page pdf-cover">
            <img
              className="cover-art"
              src="/assets/catalogo/capa-catalogo-ori-v2.png"
              alt="Seu Catálogo"
            />
            <div className="meta">Gerado em {pages.today} &nbsp;•&nbsp; {countLabel}</div>
          </div>

            {pages.builtPages.map(({ linha, chunk, pageNum }) => (
            <div className="pdf-page" key={pageNum}>
              <div className={`pdf-page-header ${linhaHeaderClass(linha)}`}>
                <img
                  className="pdf-line-banner-image"
                  src={linhaBannerSrc(linha)}
                  alt=""
                />

                <div className="pdf-line-title">
                  LINHA {String(linha).toUpperCase()}
                </div>
              </div>

              <div className="pdf-cards-grid">
                {chunk.map((item, i) => itemHtmlFor(item, i))}
              </div>

              <div className="pdf-page-footer">
                <span>Ori Indústria de Auto Peças LTDA — (11) 2542-5110</span>
                <div className="num">{String(pageNum).padStart(2, '0')}</div>
              </div>
            </div>
          ))}

          <div className="pdf-page pdf-back-cover">
            <div className="pdf-back-white">
              <div className="pdf-back-logo-wrap">
                <img
                  className="pdf-back-logo"
                  src="/assets/logo.png"
                  alt="Ori Auto Peças"
                />
              </div>

              <div className="pdf-back-rule" />

              <div className="pdf-back-content">
                <div className="pdf-back-column">
                  <div className="pdf-back-label">ORI Indústria de Auto Peças LTDA.</div>
                  <div className="pdf-back-text">Rua Reverendo Isaac Silvério, 365/369</div>
                  <div className="pdf-back-text">Ermelino Matarazzo, São Paulo, SP</div>
                  <div className="pdf-back-text">CEP: 03810-030</div>
                  <div className="pdf-back-text">(11) 2542-5110</div>
                </div>

                <div className="pdf-back-column">
                  <div className="pdf-back-label">ORI Truck Ind de Auto Peças LTDA.</div>
                  <div className="pdf-back-text">Rua Pascoal Rizzo, 25</div>
                  <div className="pdf-back-text">Ermelino Matarazzo, São Paulo, SP</div>
                  <div className="pdf-back-text">CEP: 03810-050</div>
                  <div className="pdf-back-text">(11) 2546-0671</div>
                </div>
              </div>

              <div className="pdf-back-contact">
                <div className="pdf-back-contact-title">
                  Representante
                </div>

                <div className="pdf-back-contact-name">
                  {responsavelNome}
                </div>

                {responsavelTelefone && (
                  <div className="pdf-back-contact-line">
                    {responsavelTelefone}
                  </div>
                )}

                {responsavelEmail && (
                  <div className="pdf-back-contact-line">
                    {responsavelEmail}
                  </div>
                )}
              </div>

              <div className="pdf-back-bottom">
                <span>Ori Auto Peças</span>
                <span>Catálogo gerado em {pages.today}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function createMeasurer() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:absolute; left:-9999px; top:0; visibility:hidden;';
  wrap.innerHTML = `
    <div class="pdf-page pdfpage-root">
      <div class="pdf-page-header"><div class="linha-kicker"></div></div>
      <div class="pdf-cards-grid"></div>
      <div class="pdf-page-footer"><span>Ori Indústria de Auto Peças LTDA — (11) 2542-5110</span><div class="num">00</div></div>
    </div>
  `;
  document.body.appendChild(wrap);
  const page = wrap.querySelector('.pdf-page');
  const header = wrap.querySelector('.pdf-page-header');
  const linhaKickerEl = wrap.querySelector('.linha-kicker');
  const footer = wrap.querySelector('.pdf-page-footer');
  const grid = wrap.querySelector('.pdf-cards-grid');
  let available = 0;

  function setHeader(linha) {
    linhaKickerEl.textContent = `Linha ${linha}`;

    available =
      page.getBoundingClientRect().height
      - header.getBoundingClientRect().height
      - footer.getBoundingClientRect().height;
  }

  function heightOfCard(p) {
    const aplicacao = formatAplicacoes(p.aplicacoes);
    const titulo = getProductTitle(p);

    return `
      <div class="pdf-catalog-card">
        <div class="photo"><img src="${p.foto_local}" alt=""></div>
        <div class="text">
          <div class="suitable">Suitable to</div>
          <div class="code">
            Cód. ${p.codigo}
            <span class="conv">• Conv. ${formatConversao(p.numero_conversao)}</span>
          </div>
          <div class="name">${titulo}</div>
          ${aplicacao ? `<div class="app">${aplicacao}</div>` : ''}
        </div>
      </div>
    `;
  }

  function itemMarkup(item) {
    if (item.type === 'brand') {
      return `
        <div class="pdf-brand-banner${item.continuation ? ' is-continuation' : ''}">
          ${item.text}
        </div>
      `;
    }

    if (item.type === 'category') {
      return `<div class="pdf-category-banner">${item.text}</div>`;
    }

    return heightOfCard(item.product);
  }

  function heightOf(items) {
    grid.innerHTML = items.map(itemMarkup).join('');
    return grid.scrollHeight;
  }

  return {
    setHeader,
    heightOf,
    get available() { return available; },
    cleanup() { wrap.remove(); },
  };
}

function paginateByHeight(items, measure) {
  const queue = items.slice();
  const pages = [];
  let current = [];

  function getItemBrand(item) {
    if (!item) return '';

    if (item.brand) {
      return item.brand;
    }

    if (item.type === 'brand') {
      return item.text || '';
    }

    if (item.type === 'card') {
      return item.product?.marca || '';
    }

    return '';
  }

  function getLastPageBrand() {
    if (!pages.length) return '';

    const previousPage = pages[pages.length - 1];

    for (let i = previousPage.length - 1; i >= 0; i--) {
      const brand = getItemBrand(previousPage[i]);

      if (brand) {
        return brand;
      }
    }

    return '';
  }

  function addBrandContextIfNeeded() {
    if (current.length || !queue.length) return;

    const nextItem = queue[0];

    // Se já estamos começando uma marca nova,
    // não precisamos criar outra faixa.
    if (nextItem.type === 'brand') return;

    const previousBrand = getLastPageBrand();
    const nextBrand = getItemBrand(nextItem);

    if (previousBrand && nextBrand && previousBrand === nextBrand) {
      current.push({
        type: 'brand',
        text: previousBrand,
        brand: previousBrand,
        continuation: true,
      });
    }
  }

  function finalizePage() {
    while (
      current.length &&
      current[current.length - 1].type !== 'card'
    ) {
      queue.unshift(current.pop());
    }

    if (current.length) {
      pages.push(current);
    }

    current = [];
  }

  while (queue.length) {
    addBrandContextIfNeeded();

    const item = queue.shift();
    const testItems = current.concat(item);
    const height = measure.heightOf(testItems);

    if (height > measure.available && current.length) {
      queue.unshift(item);
      finalizePage();
      continue;
    }

    current.push(item);
  }

  finalizePage();

  return pages;
}

