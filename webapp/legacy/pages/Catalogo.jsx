import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import '../styles/catalogo.css';

function normalize(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function matchesSearch(p, query) {
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

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function Catalogo() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeBrands, setActiveBrands] = useState(new Set());
  const [activeCats, setActiveCats] = useState(new Set());
  const [activeLinhas, setActiveLinhas] = useState(new Set());
  const [activeVehicle, setActiveVehicle] = useState('');
  const [activeCodigo, setActiveCodigo] = useState('');
  const [activeOriginal, setActiveOriginal] = useState('');
  const [activeBarras, setActiveBarras] = useState('');
  const [openSheet, setOpenSheet] = useState(null); // 'marca' | 'categoria' | 'linha' | 'veiculo' | 'codigo' | 'original' | 'barras'
  const [detailProduct, setDetailProduct] = useState(null);
  const [activePhoto, setActivePhoto] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    supabase
      .from('produtos')
      .select('*')
      .eq('ativo', true)
      .limit(4000)
      .then(({ data, error }) => {
        if (error) console.error(error);
        setProdutos(data ?? []);
        setLoading(false);
        const categoriaParam = searchParams.get('categoria');
        if (categoriaParam && (data ?? []).some((p) => p.categoria === categoriaParam)) {
          setActiveCats(new Set([categoriaParam]));
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getBaseListExcluding(excludeKind) {
    let list = produtos.filter((p) => matchesSearch(p, search));
    if (excludeKind !== 'marca' && activeBrands.size) list = list.filter((p) => activeBrands.has(p.marca));
    if (excludeKind !== 'categoria' && activeCats.size) list = list.filter((p) => activeCats.has(p.categoria));
    if (excludeKind !== 'linha' && activeLinhas.size)
      list = list.filter((p) => (p.linha || '').split(',').map((s) => s.trim()).some((l) => activeLinhas.has(l)));
    if (excludeKind !== 'veiculo' && activeVehicle) {
      const q = normalize(activeVehicle);
      list = list.filter((p) => normalize(p.descricao).includes(q) || normalize(p.veiculos).includes(q));
    }
    if (excludeKind !== 'codigo' && activeCodigo) {
      const q = normalize(activeCodigo);
      list = list.filter((p) => normalize(p.codigo).includes(q));
    }
    if (excludeKind !== 'original' && activeOriginal) {
      const q = normalize(activeOriginal);
      list = list.filter((p) => normalize(p.original).includes(q));
    }
    if (excludeKind !== 'barras' && activeBarras) {
      const q = normalize(activeBarras);
      list = list.filter((p) => normalize(p.barras).includes(q));
    }
    return list;
  }

  const filteredList = useMemo(() => {
    const list = getBaseListExcluding(null);
    return list.slice().sort((a, b) => parseInt(a.codigo, 10) - parseInt(b.codigo, 10));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtos, search, activeBrands, activeCats, activeLinhas, activeVehicle, activeCodigo, activeOriginal, activeBarras]);

  function labelFor(set, allLabel) {
    if (set.size === 0) return allLabel;
    if (set.size === 1) return [...set][0];
    return `${set.size} selecionadas`;
  }

  function clearAll() {
    setActiveBrands(new Set());
    setActiveCats(new Set());
    setActiveLinhas(new Set());
    setActiveVehicle('');
    setActiveCodigo('');
    setActiveOriginal('');
    setActiveBarras('');
    setSearch('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleBaixarPdf() {
    if (!session) {
      navigate('/login');
      return;
    }
    localStorage.setItem('ori_catalogo_ids', JSON.stringify(filteredList.map((p) => p.id)));
    const novaJanela = window.open('/catalogo/pdf', '_blank');
    if (!novaJanela) {
      navigate('/catalogo/pdf');
    }
  }

  return (
    <div>
      <div className="cat-topbar">
        <div className="cat-header">
          <div className="cat-brand">
            <a className="logo-badge" href="/"><img src="/assets/logo.png" alt="Ori" /></a>
            <button className="clear-icon-btn" onClick={clearAll} type="button" aria-label="Limpar seleção" title="Limpar seleção">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" />
              </svg>
            </button>
            <button className="pdf-header-btn pdf-mobile-only" type="button" onClick={handleBaixarPdf}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
              </svg>
              PDF
            </button>
            <button className="pdf-inline-btn pdf-desktop-only" type="button" onClick={handleBaixarPdf}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
              </svg>
              Baixar catálogo em PDF
            </button>
          </div>

          <div className="cat-search-row">
            <div className="cat-search-box">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Buscar por código ou descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="cat-filters">
          <button type="button" className={`filter-btn ${activeBrands.size ? 'set' : ''}`} onClick={() => setOpenSheet('marca')}>
            <span className="label">{labelFor(activeBrands, 'Marcas')}</span>
            {!activeBrands.size && <ChevronIcon />}
          </button>
          <button type="button" className={`filter-btn ${activeCats.size ? 'set' : ''}`} onClick={() => setOpenSheet('categoria')}>
            <span className="label">{labelFor(activeCats, 'Categorias')}</span>
            {!activeCats.size && <ChevronIcon />}
          </button>
          <button type="button" className={`filter-btn ${activeVehicle ? 'set' : ''}`} onClick={() => setOpenSheet('veiculo')}>
            <span className="label">{activeVehicle || 'Veículo'}</span>
            {!activeVehicle && <ChevronIcon />}
          </button>
          <button type="button" className={`filter-btn ${activeLinhas.size ? 'set' : ''}`} onClick={() => setOpenSheet('linha')}>
            <span className="label">{labelFor(activeLinhas, 'Linhas')}</span>
            {!activeLinhas.size && <ChevronIcon />}
          </button>
          <button type="button" className={`filter-btn ${activeCodigo ? 'set' : ''}`} onClick={() => setOpenSheet('codigo')}>
            <span className="label">{activeCodigo || 'Código'}</span>
            {!activeCodigo && <ChevronIcon />}
          </button>
          <button type="button" className={`filter-btn ${activeOriginal ? 'set' : ''}`} onClick={() => setOpenSheet('original')}>
            <span className="label">{activeOriginal || 'Original'}</span>
            {!activeOriginal && <ChevronIcon />}
          </button>
          <button type="button" className={`filter-btn ${activeBarras ? 'set' : ''}`} onClick={() => setOpenSheet('barras')}>
            <span className="label">{activeBarras || 'Barras'}</span>
            {!activeBarras && <ChevronIcon />}
          </button>
        </div>
      </div>

      <div className="result-count">
        <span>{loading ? 'Carregando...' : `${filteredList.length}${filteredList.length === 1 ? ' peça encontrada' : ' peças encontradas'}`}</span>
      </div>

      <div className="cat-grid">
        {!loading && filteredList.length === 0 && <div className="empty-state">Nenhuma peça encontrada</div>}
        {filteredList.map((p) => (
          <div className="cat-card" key={p.id} onClick={() => { setDetailProduct(p); setActivePhoto(p.galeria?.[0]?.gde || p.foto_local_gde || p.foto_local); setLightboxOpen(false); }}>
            <div className="thumb"><img loading="lazy" src={p.foto_local} alt="" /></div>
            <div className="info">
              <div className="marca-tag">{p.marca}</div>
              <div className="descricao">{p.descricao}</div>
              <div className="codigo">Cód. {p.codigo}{p.numero_conversao ? ` — Conv. ${p.numero_conversao}` : ''}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="cat-footer">Catálogo em expansão — em breve com a linha completa de produtos</div>

      {openSheet && ['marca', 'categoria', 'linha'].includes(openSheet) && (
        <MultiSelectSheet
          kind={openSheet}
          activeSet={openSheet === 'marca' ? activeBrands : openSheet === 'categoria' ? activeCats : activeLinhas}
          setActiveSet={openSheet === 'marca' ? setActiveBrands : openSheet === 'categoria' ? setActiveCats : setActiveLinhas}
          baseList={getBaseListExcluding(openSheet)}
          onClose={() => setOpenSheet(null)}
        />
      )}

      {openSheet === 'veiculo' && (
        <TextFilterSheet
          title="Filtrar por veículo"
          placeholder="Ex: Gol, Corolla, Ducato..."
          hint="Busca pelo nome do veículo dentro da descrição da peça."
          value={activeVehicle}
          onChange={setActiveVehicle}
          countLabel={(n) => (n === produtos.length ? 'Todos os veículos' : 'Peças compatíveis')}
          baseList={getBaseListExcluding('veiculo')}
          matchField={(p, q) => normalize(p.descricao).includes(q) || normalize(p.veiculos).includes(q)}
          onClose={() => setOpenSheet(null)}
        />
      )}
      {openSheet === 'codigo' && (
        <TextFilterSheet
          title="Filtrar por código do produto"
          placeholder="Ex: 1001"
          hint="Busca pelo código Ori do produto — pode digitar só uma parte do número."
          value={activeCodigo}
          onChange={setActiveCodigo}
          countLabel={() => 'Peças compatíveis'}
          baseList={getBaseListExcluding('codigo')}
          matchField={(p, q) => normalize(p.codigo).includes(q)}
          onClose={() => setOpenSheet(null)}
        />
      )}
      {openSheet === 'original' && (
        <TextFilterSheet
          title="Filtrar por código original"
          placeholder="Ex: 3058235053"
          hint="Busca pelo código original do fabricante do veículo — pode digitar só uma parte."
          value={activeOriginal}
          onChange={setActiveOriginal}
          countLabel={() => 'Peças compatíveis'}
          baseList={getBaseListExcluding('original')}
          matchField={(p, q) => normalize(p.original).includes(q)}
          onClose={() => setOpenSheet(null)}
        />
      )}
      {openSheet === 'barras' && (
        <TextFilterSheet
          title="Filtrar por código de barras"
          placeholder="Ex: 7898280520133"
          hint="Busca pelo código de barras Ori — pode digitar só uma parte do número."
          value={activeBarras}
          onChange={setActiveBarras}
          countLabel={() => 'Peças compatíveis'}
          baseList={getBaseListExcluding('barras')}
          matchField={(p, q) => normalize(p.barras).includes(q)}
          onClose={() => setOpenSheet(null)}
        />
      )}

      {detailProduct && (
        <div className="cat-overlay" onClick={(e) => { if (e.target === e.currentTarget) setDetailProduct(null); }}>
          <div className="cat-sheet-wrap">
            <div className="cat-sheet">
              <div className="sheet-handle" />
              <button className="close-btn" onClick={() => setDetailProduct(null)}>&times;</button>
              <div className="thumb-big" onClick={() => setLightboxOpen(true)} style={{ cursor: 'zoom-in' }}>
                <img src={activePhoto} alt="" />
              </div>
              {detailProduct.galeria?.length > 1 && (
                <div className="gallery-strip">
                  {detailProduct.galeria.map((g, i) => (
                    <img
                      key={i}
                      className={`gallery-thumb ${activePhoto === g.gde ? 'active' : ''}`}
                      src={g.peq}
                      onClick={() => setActivePhoto(g.gde)}
                      alt=""
                    />
                  ))}
                </div>
              )}
              <div className="body">
                <h2>{detailProduct.descricao}</h2>
                <div>
                  <div className="row"><span>Código Ori</span><span>{detailProduct.codigo}</span></div>
                  <div className="row"><span>Código Original</span><span>{detailProduct.original || '—'}</span></div>
                  {detailProduct.numero_conversao && (
                    <div className="row"><span>Código de Conversão</span><span>{detailProduct.numero_conversao}</span></div>
                  )}
                  <div className="row"><span>Marca</span><span>{detailProduct.marca}</span></div>
                  <div className="row"><span>Categoria</span><span>{detailProduct.categoria || '—'}</span></div>
                  <div className="row"><span>Peso líquido</span><span>{detailProduct.peso_liquido || '—'}</span></div>
                  <div className="row"><span>Código de barras</span><span>{detailProduct.barras || '—'}</span></div>
                </div>
                {detailProduct.aplicacoes?.length > 0 && (
                  <div className="applic-section">
                    <div className="applic-title">
                      Aplicação veicular
                      <span className="applic-badge">{detailProduct.aplicacoes.length} veículos</span>
                    </div>
                    {detailProduct.aplicacoes.map((a, i) => (
                      <div className="applic-card" key={i}>
                        <div className="applic-vehicle">
                          <span className="applic-name">{a.veiculo}</span>
                          {a.geracao && <span className="applic-gen">{a.geracao}</span>}
                        </div>
                        <div className="applic-meta">
                          {a.portas && <span>{a.portas} portas</span>}
                          <span>{a.ano_apos}{a.ate ? ` a ${a.ate}` : ' em diante'}</span>
                        </div>
                        {a.obs && <div className="applic-obs">{a.obs}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {lightboxOpen && (
        <div className="cat-lightbox" onClick={() => setLightboxOpen(false)}>
          <button className="cat-lightbox-close" onClick={() => setLightboxOpen(false)}>&times;</button>
          <img src={activePhoto} alt="" />
        </div>
      )}
    </div>
  );
}

function MultiSelectSheet({ kind, activeSet, setActiveSet, baseList, onClose }) {
  const [filterText, setFilterText] = useState('');
  const field = kind === 'marca' ? 'marca' : kind === 'categoria' ? 'categoria' : 'linha';
  const substringMatch = kind === 'linha';
  const allLabel = kind === 'marca' ? 'Todas as marcas' : kind === 'categoria' ? 'Todas as categorias' : 'Todas as linhas';
  const title = kind === 'marca' ? 'Filtrar por marca' : kind === 'categoria' ? 'Filtrar por categoria' : 'Filtrar por linha';
  const placeholder = kind === 'marca' ? 'marca' : kind === 'categoria' ? 'categoria' : 'linha';

  const counts = {};
  const optionSet = new Set();
  baseList.forEach((p) => {
    const v = p[field];
    if (!v) return;
    if (substringMatch) {
      v.split(',').map((s) => s.trim()).filter(Boolean).forEach((part) => {
        optionSet.add(part);
        counts[part] = (counts[part] || 0) + 1;
      });
    } else {
      optionSet.add(v);
      counts[v] = (counts[v] || 0) + 1;
    }
  });
  const q = normalize(filterText);
  const options = [...optionSet].sort().filter((o) => normalize(o).includes(q));

  function toggle(val) {
    const next = new Set(activeSet);
    if (next.has(val)) next.delete(val); else next.add(val);
    setActiveSet(next);
  }

  return (
    <div className="cat-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cat-sheet-wrap">
        <div className="cat-sheet">
          <div className="sheet-handle" />
          <button className="close-btn" onClick={onClose}>&times;</button>
          <div className="sheet-title">{title} <span style={{ fontWeight: 400, fontSize: 12.5, color: 'var(--text-dim)' }}>(pode marcar mais de um)</span></div>
          <input
            type="text"
            className="sheet-search"
            placeholder={`Buscar ${placeholder}...`}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            autoFocus
          />
          <div className="option-list">
            {!q && (
              <div className={`option-item ${activeSet.size === 0 ? 'selected' : ''}`} onClick={() => setActiveSet(new Set())}>
                <span>{allLabel}</span><span className="count">{baseList.length}</span>
              </div>
            )}
            {options.map((o) => (
              <div key={o} className={`option-item ${activeSet.has(o) ? 'selected' : ''}`} onClick={() => toggle(o)}>
                <span>{activeSet.has(o) ? '☑' : '☐'} {o}</span><span className="count">{counts[o]}</span>
              </div>
            ))}
            {options.length === 0 && q && (
              <div className="option-item" style={{ color: 'var(--text-dim)', cursor: 'default' }}>Nenhum resultado</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TextFilterSheet({ title, placeholder, hint, value, onChange, countLabel, baseList, matchField, onClose }) {
  const q = normalize(value);
  const n = q ? baseList.filter((p) => matchField(p, q)).length : baseList.length;
  return (
    <div className="cat-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cat-sheet-wrap">
        <div className="cat-sheet">
          <div className="sheet-handle" />
          <button className="close-btn" onClick={onClose}>&times;</button>
          <div className="sheet-title">{title}</div>
          <input
            type="text"
            className="sheet-search"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoFocus
          />
          <div className="sheet-hint">{hint}</div>
          <div className="option-list">
            <div className="option-item" style={{ cursor: 'default' }}>
              <span>{q ? countLabel(n) : 'Todos os itens'}</span><span className="count">{n}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
