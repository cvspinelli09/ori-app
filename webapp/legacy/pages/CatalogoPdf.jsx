import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import '../styles/catalogo-pdf.css';

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

function buildItems(marcaPicks) {
  const catGroups = groupPreservingOrder(marcaPicks, (p) => p.categoria || 'Diversos');
  const items = [];
  catGroups.forEach(([categoria, catPicks]) => {
    items.push({ type: 'banner', text: categoria });
    catPicks.forEach((p) => items.push({ type: 'card', product: p }));
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

function splitDesc(desc) {
  const idx = (desc || '').indexOf(' - ');
  if (idx === -1) return { name: null, app: null };
  return { name: desc.slice(0, idx), app: desc.slice(idx + 3) };
}

function ProductCard({ p }) {
  const { name, app } = splitDesc(p.descricao);
  return (
    <div className="pdf-catalog-card">
      <div className="photo"><img src={p.foto_local} alt="" /></div>
      <div className="text">
        <div className="suitable">Suitable to</div>
        <div className="code">
          Cód. {p.codigo}
          {p.numero_conversao && <span className="conv"> • Conv. {p.numero_conversao}</span>}
        </div>
        {name ? (
          <>
            <div className="name">{name}</div>
            <div className="app">{app}</div>
          </>
        ) : (
          <div className="app">{p.descricao}</div>
        )}
      </div>
    </div>
  );
}

function itemHtmlFor(item, key) {
  return item.type === 'banner'
    ? <div className="pdf-category-banner" key={key}>{item.text}</div>
    : <ProductCard p={item.product} key={key} />;
}

export function CatalogoPdf() {
  const navigate = useNavigate();
  const { session, profile, loading: authLoading } = useAuth();
  const [pages, setPages] = useState(null);
  const [regiao, setRegiao] = useState('');
  const regiaoTouched = useRef(false);
  const measureRef = useRef(null);
  const pagesWrapRef = useRef(null);
  const pagesElRef = useRef(null);

  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then((r) => r.json())
      .then((data) => {
        if (regiaoTouched.current || data.error) return;
        const partes = [data.city, data.region].filter(Boolean);
        if (partes.length) setRegiao(partes.join(', '));
      })
      .catch(() => { /* estimativa de região é só conveniência, falha silenciosa */ });
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
        const marcaGroups = groupPreservingOrder(linhaPicks, (p) => p.marca || 'Outras');
        marcaGroups.forEach(([marca, marcaPicks]) => {
          measure.setHeader(linha, marca);
          const items = buildItems(marcaPicks);
          const chunks = paginateByHeight(items, measure);
          chunks.forEach((chunk) => {
            builtPages.push({ linha, marca, chunk, pageNum });
            pageNum++;
          });
        });
      });

      measure.cleanup();
      if (!cancelled) {
        setPages({ picks, builtPages, today: new Date().toLocaleDateString('pt-br'), isFullCatalog: ids.length === 0 });
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

  async function handlePrint() {
    const insertPromise = supabase.from('leads').insert({
      nome: profile?.nome || session.user.email,
      email: session.user.email,
      vendedor_id: profile?.role === 'vendedor' ? session.user.id : null,
      produtos_selecionados: pages.picks.map((p) => ({ id: p.id, codigo: p.codigo, descricao: p.descricao })),
      origem: 'catalogo_pdf',
      regiao: regiao.trim() || null,
    });

    // window.print() bloqueia a aba de forma síncrona assim que é chamado —
    // sem esperar aqui, o navegador pode não ter tempo de sequer enviar o
    // insert antes de travar na janela de impressão. O timeout evita travar
    // o download se a rede estiver lenta/offline.
    const { error } = await Promise.race([
      insertPromise,
      new Promise((resolve) => setTimeout(() => resolve({ error: null }), 2000)),
    ]);
    if (error) console.error(error);

    window.print();
  }

  if (!pages) {
    return <div className="pdfpage-root"><p style={{ padding: 24 }}>Montando catálogo...</p></div>;
  }

  const countLabel = pages.isFullCatalog
    ? `${pages.picks.length} peças — catálogo completo`
    : `${pages.picks.length} peças selecionadas`;

  return (
    <div className="pdfpage-root" ref={measureRef}>
      <div className="pdf-toolbar">
        <span>Pré-visualização do catálogo — na janela de impressão, use margens "Nenhuma" e marque "Imprimir gráficos de segundo plano"</span>
        <input
          type="text"
          className="pdf-regiao-input"
          placeholder="Cidade/Estado"
          value={regiao}
          onChange={(e) => { regiaoTouched.current = true; setRegiao(e.target.value); }}
          title="Cidade/Estado — preenchido automaticamente por estimativa, edite se estiver errado"
        />
        <button onClick={handlePrint}>Imprimir / Salvar PDF</button>
      </div>

      <div id="pdfPagesWrap" ref={pagesWrapRef}>
        <div id="pdfPages" ref={pagesElRef}>
          <div className="pdf-page pdf-cover">
            <img className="cover-art" src="/assets/capa_seu_catalogo.png" alt="Seu Catálogo" />
            <div className="meta">Gerado em {pages.today} &nbsp;•&nbsp; {countLabel}</div>
          </div>

          {pages.builtPages.map(({ linha, marca, chunk, pageNum }) => (
            <div className="pdf-page" key={pageNum}>
              <div className={`pdf-page-header ${linhaHeaderClass(linha)}`}>
                <div className="linha-kicker">Linha {linha}</div>
                <div className="marca-title">{marca}</div>
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
      <div class="pdf-page-header"><div class="linha-kicker"></div><div class="marca-title"></div></div>
      <div class="pdf-cards-grid"></div>
      <div class="pdf-page-footer"><span>Ori Indústria de Auto Peças LTDA — (11) 2542-5110</span><div class="num">00</div></div>
    </div>
  `;
  document.body.appendChild(wrap);
  const page = wrap.querySelector('.pdf-page');
  const header = wrap.querySelector('.pdf-page-header');
  const linhaKickerEl = wrap.querySelector('.linha-kicker');
  const marcaTitleEl = wrap.querySelector('.marca-title');
  const footer = wrap.querySelector('.pdf-page-footer');
  const grid = wrap.querySelector('.pdf-cards-grid');
  let available = 0;

  function setHeader(linha, marca) {
    linhaKickerEl.textContent = `Linha ${linha}`;
    marcaTitleEl.textContent = marca;
    available = page.getBoundingClientRect().height
      - header.getBoundingClientRect().height
      - footer.getBoundingClientRect().height;
  }

  function heightOfCard(p) {
    const { name, app } = splitDesc(p.descricao);
    return `
      <div class="pdf-catalog-card">
        <div class="photo"><img src="${p.foto_local}" alt=""></div>
        <div class="text">
          <div class="suitable">Suitable to</div>
          <div class="code">Cód. ${p.codigo}${p.numero_conversao ? ' <span class="conv">• Conv. ' + p.numero_conversao + '</span>' : ''}</div>
          ${name ? `<div class="name">${name}</div><div class="app">${app}</div>` : `<div class="app">${p.descricao}</div>`}
        </div>
      </div>
    `;
  }

  function itemMarkup(item) {
    return item.type === 'banner'
      ? `<div class="pdf-category-banner">${item.text}</div>`
      : heightOfCard(item.product);
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

  function finalizePage() {
    while (current.length && current[current.length - 1].type === 'banner') {
      queue.unshift(current.pop());
    }
    if (current.length) pages.push(current);
    current = [];
  }

  while (queue.length) {
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
