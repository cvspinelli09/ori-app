import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';

const PRODUCT_FIELDS = 'id::text,codigo,descricao,marca,marcas,linha,ativo';

function requireProductId(value) {
  if (typeof value !== 'string' || !/^-?\d+$/.test(value)) {
    throw new Error('O servidor não retornou um ID de produto textual válido.');
  }
  return value;
}

// Avança pelo total recebido, inclusive quando a API limita a página.
// Uma página vazia confirma o fim; erros nunca representam uma lista vazia.
async function readAllPages(makeQuery, signal) {
  const rows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await makeQuery().range(offset, offset + 499).abortSignal(signal);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('Resposta de consulta inválida.');
    if (!data.length) return rows;
    rows.push(...data);
    offset += data.length;
  }
}

function FamilyBrandPicker({ value, selected, showError, onChange, onValidityChange, disabled }) {
  const [brands, setBrands] = useState([]);
  const [status, setStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [legacyValue] = useState(value);
  const listId = useId();
  const optionRefs = useRef([]);
  const inputRef = useRef(null);
  const [selectionAttempted, setSelectionAttempted] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const rows = await readAllPages(() => supabase.from('produtos')
          .select('marca,marcas').order('id'), controller.signal);
        const values = new Set();
        rows.forEach((row) => {
          [row.marca, ...(Array.isArray(row.marcas) ? row.marcas : [])].forEach((brand) => {
            if (typeof brand === 'string' && brand.trim()) values.add(brand.trim());
          });
        });
        if (controller.signal.aborted) return;
        setBrands([...values].sort((a, b) => a.localeCompare(b, 'pt-BR')));
        setStatus('ready');
      } catch {
        if (!controller.signal.aborted) setStatus('error');
      }
    })();
    return () => controller.abort();
  }, [attempt]);

  // Apenas a Marca original pode ser preservada como exceção legada.
  // O texto de pesquisa nunca entra na lista de opções nem no payload.
  const options = [...new Set([legacyValue, ...brands].filter(Boolean))];
  const visible = options.filter((brand) => !filtering ||
    brand.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')));

  function choose(brand) {
    if (disabled || !options.includes(brand) || (status !== 'ready' && brand !== legacyValue)) return;
    setSelectionAttempted(false);
    onChange(brand);
    onValidityChange(true);
    setQuery(brand);
    setFiltering(false);
    setOpen(false);
    setActiveIndex(-1);
  }

  function move(direction) {
    setOpen(true);
    if (!visible.length) return;
    const next = !open || activeIndex < 0
      ? (direction > 0 ? 0 : visible.length - 1)
      : (activeIndex + direction + visible.length) % visible.length;
    setActiveIndex(next);
    optionRefs.current[next]?.scrollIntoView({ block: 'nearest' });
  }

  return <div className="admin2-field admin2-family-brand-picker"
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActiveIndex(-1); if (query.trim() && !selected) setSelectionAttempted(true); } }}>
    <label htmlFor={`${listId}-input`}>Marca *</label>
    <div className="admin2-family-brand-control">
    <input ref={inputRef} id={listId + '-input'} role="combobox" aria-autocomplete="list"
      aria-expanded={open} aria-controls={`${listId}-options`}
      aria-activedescendant={open && activeIndex >= 0 && visible[activeIndex] ? `${listId}-option-${activeIndex}` : undefined}
      aria-describedby={`${listId}-status`} aria-invalid={(selectionAttempted || showError) && !selected}
      autoComplete="off" value={query} disabled={disabled}
      placeholder="Digite e selecione uma marca"
      onFocus={() => { setOpen(true); setFiltering(false); setActiveIndex(-1); }}
      onChange={(event) => {
        setQuery(event.target.value); setFiltering(true); setOpen(true); setActiveIndex(-1);
        setSelectionAttempted(false);
        onValidityChange(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); move(event.key === 'ArrowDown' ? 1 : -1);
        } else if (event.key === 'Enter') {
          event.preventDefault();
          if (open && activeIndex >= 0 && visible[activeIndex]) choose(visible[activeIndex]);
          else if (!selected) setSelectionAttempted(true);
        } else if (event.key === 'Escape') {
          event.preventDefault(); event.stopPropagation();
          setOpen(false); setActiveIndex(-1); setFiltering(false); setQuery(value);
          setSelectionAttempted(false);
          onValidityChange(Boolean(value));
        }
      }} />
    <button type="button" className="admin2-family-brand-chevron" disabled={disabled}
      aria-label="Abrir lista de marcas" aria-expanded={open} aria-controls={`${listId}-options`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => { inputRef.current?.focus(); setOpen(true); setFiltering(false); setActiveIndex(-1); }}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    </div>
    {open && <ul id={`${listId}-options`} role="listbox" aria-label="Marcas cadastradas" className="admin2-family-brand-options">
      {visible.map((brand, index) => <li key={brand} id={`${listId}-option-${index}`}
        ref={(element) => { optionRefs.current[index] = element; }} role="option"
        aria-selected={brand === value} aria-disabled={status !== 'ready' && brand !== legacyValue}
        className={index === activeIndex ? 'is-active' : ''}
        onMouseDown={(event) => event.preventDefault()} onClick={() => choose(brand)}>
        {brand}{brand === legacyValue && status === 'ready' && !brands.includes(brand) ? ' (valor legado atual)' : ''}
      </li>)}
      {status === 'ready' && !visible.length && <li role="presentation">Nenhuma marca encontrada.</li>}
    </ul>}
    <div id={`${listId}-status`} aria-live="polite">
      {status === 'loading' && <small>Carregando todas as marcas...</small>}
      {status === 'error' && <div role="alert">Não foi possível carregar as marcas. O valor atual foi preservado. <button type="button" disabled={disabled} onClick={() => { setStatus('loading'); setAttempt((n) => n + 1); }}>Tentar novamente</button></div>}
      {status === 'ready' && !brands.length && <small>Nenhuma marca cadastrada disponível.</small>}

    </div>
  </div>;
}
function useFamilyProducts(familiaId) {
  const [state, setState] = useState({ status: familiaId ? 'loading' : 'ready', ids: [], initialIds: [], products: new Map(), detailError: false });
  const [attempt, setAttempt] = useState(0);
  const [detailAttempt, setDetailAttempt] = useState(0);

  useEffect(() => {
    if (!familiaId) return;
    const controller = new AbortController();
    (async () => {
      try {
        const rows = await readAllPages(() => supabase.from('catalogo_familias_produtos')
          .select('produto_id::text').eq('familia_id', familiaId).order('produto_id'), controller.signal);
        const ids = [...new Set(rows.map((row) => requireProductId(row.produto_id)))];
        if (!controller.signal.aborted) setState({ status: 'ready', ids, initialIds: ids, products: new Map(), detailError: false });
      } catch {
        if (!controller.signal.aborted) setState((current) => ({ ...current, status: 'error' }));
      }
    })();
    return () => controller.abort();
  }, [familiaId, attempt]);

  // Falhas nos detalhes não removem IDs nem recarregam a seleção do usuário.
  const initialIds = state.initialIds;
  const ready = state.status === 'ready';
  useEffect(() => {
    if (!ready || !initialIds.length) return;
    const controller = new AbortController();
    (async () => {
      const details = new Map();
      let detailError = false;
      for (let offset = 0; offset < initialIds.length; offset += 50) {
        try {
          const rows = await readAllPages(() => supabase.from('produtos').select(PRODUCT_FIELDS)
            .in('id', initialIds.slice(offset, offset + 50)).order('id'), controller.signal);
          rows.forEach((product) => details.set(requireProductId(product.id), product));
        } catch {
          detailError = true;
        }
        if (controller.signal.aborted) return;
      }
      setState((current) => ({ ...current, products: new Map([...current.products, ...details]), detailError }));
    })();
    return () => controller.abort();
  }, [ready, initialIds, detailAttempt]);

  const changed = state.ids.length !== state.initialIds.length ||
    state.ids.some((id) => !state.initialIds.includes(id));
  return {
    ...state, changed,
    retry: () => { setState((current) => ({ ...current, status: 'loading' })); setAttempt((n) => n + 1); },
    retryDetails: () => setDetailAttempt((n) => n + 1),
    add: (product) => setState((current) => {
      const id = requireProductId(product.id);
      if (current.status !== 'ready' || product.ativo !== true || current.ids.includes(id)) return current;
      return { ...current, ids: [...current.ids, id], products: new Map([...current.products, [id, product]]) };
    }),
    remove: (id) => setState((current) => current.status === 'ready'
      ? { ...current, ids: current.ids.filter((item) => item !== id) } : current),
  };
}

function ProductSummary({ product, id }) {
  if (!product) return <div><strong>Produto indisponível</strong><small>ID: {id} · vínculo preservado</small></div>;
  const brands = [...new Set([product.marca, ...(Array.isArray(product.marcas) ? product.marcas : [])].filter(Boolean))];
  return <div><strong>Cód. {product.codigo} · {product.descricao || 'Sem descrição'}</strong>
    <small>Marca(s): {brands.join(', ') || '—'} · Linha: {product.linha || '—'}</small>
    <small>{product.ativo === true ? 'Ativo' : 'Inativo'} · ID: {id}</small></div>;
}

function FamilyProductsPicker({ selection, disabled }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({ status: 'idle', rows: [], more: false });
  useEffect(() => {
    const controller = new AbortController();
    const code = query.trim();
    if (!code) return () => controller.abort();
    const timer = setTimeout(async () => {
      try {
        const escaped = code.replace(/[\\%_*]/g, (char) => `\\${char}`);
        const [exact, prefix] = await Promise.all([
          supabase.from('produtos').select(PRODUCT_FIELDS).eq('codigo', code).order('id')
            .range(page * 20, page * 20 + 20).abortSignal(controller.signal),
          supabase.from('produtos').select(PRODUCT_FIELDS).ilike('codigo', `${escaped}%`)
            .neq('codigo', code).order('codigo').order('id')
            .range(page * 20, page * 20 + 20).abortSignal(controller.signal),
        ]);
        if (exact.error) throw exact.error;
        if (prefix.error) throw prefix.error;
        const exactRows = exact.data ?? [];
        const prefixRows = prefix.data ?? [];
        const rows = [...exactRows.slice(0, 20), ...prefixRows.slice(0, 20)];
        rows.forEach((product) => requireProductId(product.id));
        if (!controller.signal.aborted) setResult({ status: 'ready', rows, more: exactRows.length > 20 || prefixRows.length > 20 });
      } catch {
        if (!controller.signal.aborted) setResult({ status: 'error', rows: [], more: false });
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, page, attempt]);

  const blocked = disabled || selection.status !== 'ready';
  return <fieldset className="admin2-family-products"><legend>Produtos relacionados</legend>
    <label className="admin2-field"><input aria-label="Pesquisar código ORI" value={query} disabled={blocked}
      placeholder="Pesquisar código ORI" onChange={(event) => { setQuery(event.target.value); setPage(0); setResult({ status: event.target.value.trim() ? 'loading' : 'idle', rows: [], more: false }); }} /></label>
    <small>Código exato primeiro; confira o ID antes de adicionar.</small>

    {selection.status === 'loading' && <p role="status">Carregando todos os vínculos...</p>}
    {selection.status === 'error' && <p role="alert">Não foi possível carregar os vínculos. O salvamento está bloqueado. <button type="button" disabled={disabled} onClick={selection.retry}>Tentar novamente</button></p>}
    {selection.status === 'ready' && <>
      <p role="status">{selection.ids.length ? `${selection.ids.length} produtos vinculados` : 'Nenhum produto vinculado.'}</p>
      {selection.detailError && <p role="alert">Alguns detalhes não puderam ser carregados. Os IDs foram preservados. <button type="button" disabled={disabled} onClick={selection.retryDetails}>Tentar novamente</button></p>}
      <ul className="admin2-family-product-list">{selection.ids.map((id) => <li key={id}>
        <ProductSummary product={selection.products.get(id)} id={id} />
        <button type="button" disabled={blocked} onClick={() => selection.remove(id)}>Remover</button>
      </li>)}</ul>
    </>}
    {result.status === 'loading' && <p role="status">Pesquisando produtos...</p>}
    {result.status === 'error' && <p role="alert">Não foi possível pesquisar. <button type="button" disabled={blocked} onClick={() => { setResult({ status: 'loading', rows: [], more: false }); setAttempt((n) => n + 1); }}>Tentar novamente</button></p>}
    {result.status === 'ready' && <>
      {!result.rows.length && <p>Nenhum produto encontrado nesta página.</p>}
      <ul className="admin2-family-product-list">{result.rows.map((product) => <li key={product.id}>
        <ProductSummary product={product} id={product.id} />
        <button type="button" disabled={blocked || product.ativo !== true || selection.ids.includes(product.id)}
          onClick={() => selection.add(product)}>{selection.ids.includes(product.id) ? 'Já vinculado' : product.ativo !== true ? 'Inativo' : 'Adicionar'}</button>
      </li>)}</ul>
      <div className="admin2-family-product-pagination"><button type="button" disabled={blocked || page === 0} onClick={() => { setResult({ status: 'loading', rows: [], more: false }); setPage((n) => n - 1); }}>Anterior</button><span>Página {page + 1}</span><button type="button" disabled={blocked || !result.more} onClick={() => { setResult({ status: 'loading', rows: [], more: false }); setPage((n) => n + 1); }}>Próxima</button></div>
    </>}
  </fieldset>;
}

const EMPTY_PAGE = () => ({
  clientId: crypto.randomUUID(),
  imagem_url: '',
  preview_url: '',
  titulo: '',
  ativo: true,
  file: null,
});

function isFamiliesLine(nome) {
  return String(nome ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR') === 'familias';
}

async function uploadFamilyImage(session, file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', 'familias');

  const response = await fetch(
    import.meta.env.VITE_API_URL
      ? `${import.meta.env.VITE_API_URL}/upload`
      : '/api/upload',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: formData,
    }
  );
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Falha no upload da imagem.');
  }

  return data.url;
}

function makeDraft(familia) {
  return {
    nome: familia?.nome ?? '',
    marca: familia?.marca ?? '',
    veiculo: familia?.veiculo ?? '',
    anos: familia?.anos ?? '',
    ordem: familia?.ordem ?? 10,
    ativo: familia?.ativo ?? true,
  };
}

function rpcFamilyPayload(familia, ativo = familia.ativo) {
  return {
    nome: familia.nome?.trim() ?? '',
    marca: familia.marca ?? '',
    veiculo: familia.veiculo?.trim() ?? '',
    anos: familia.anos?.trim() ?? '',
    ordem: Number(familia.ordem) || 0,
    ativo,
  };
}

function rpcPagesPayload(paginas) {
  return paginas
    .filter((pagina) => pagina.imagem_url && !pagina.imagem_url.startsWith('blob:'))
    .map((pagina) => ({
      ...(pagina.id ? { id: pagina.id } : {}),
      imagem_url: pagina.imagem_url,
      titulo: pagina.titulo?.trim() ?? '',
      ativo: Boolean(pagina.ativo),
    }));
}

async function saveFamilyRpc({ familiaId, familia, linhaIds, paginas, produtoIds }) {
  const { error: rpcError } = await supabase.rpc('salvar_catalogo_familia', {
    p_familia_id: familiaId ?? null,
    p_familia: { ...rpcFamilyPayload(familia), ...(produtoIds !== undefined ? { produto_ids: produtoIds } : {}) },
    p_linha_ids: linhaIds,
    p_paginas: rpcPagesPayload(paginas),
  });

  if (rpcError) throw rpcError;
}

export function FamiliesSection({ session }) {
  const [familias, setFamilias] = useState([]);
  const [linhas, setLinhas] = useState([]);
  const [pagesByFamily, setPagesByFamily] = useState(new Map());
  const [lineIdsByFamily, setLineIdsByFamily] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const [familiasResult, linhasResult, paginasResult, vinculosResult] =
        await Promise.all([
          supabase
            .from('catalogo_familias')
            .select('id, nome, marca, veiculo, anos, ordem, ativo')
            .order('ordem', { ascending: true })
            .order('nome', { ascending: true }),
          supabase
            .from('catalogo_linhas')
            .select('id, nome, ordem, ativo')
            .order('ordem', { ascending: true })
            .order('nome', { ascending: true }),
          supabase
            .from('catalogo_familias_paginas')
            .select('id, familia_id, imagem_url, titulo, ordem, ativo')
            .order('ordem', { ascending: true }),
          supabase
            .from('catalogo_familias_linhas')
            .select('familia_id, linha_id'),
        ]);

      const firstError = [familiasResult, linhasResult, paginasResult, vinculosResult]
        .map((result) => result.error)
        .find(Boolean);
      if (firstError) throw firstError;

      const nextPages = new Map();
      for (const pagina of paginasResult.data ?? []) {
        const current = nextPages.get(pagina.familia_id) ?? [];
        current.push(pagina);
        nextPages.set(pagina.familia_id, current);
      }
      const nextLineIds = new Map();
      for (const vinculo of vinculosResult.data ?? []) {
        const current = nextLineIds.get(vinculo.familia_id) ?? [];
        current.push(vinculo.linha_id);
        nextLineIds.set(vinculo.familia_id, current);
      }

      setFamilias(familiasResult.data ?? []);
      setLinhas((linhasResult.data ?? []).filter((linha) => !isFamiliesLine(linha.nome)));
      setPagesByFamily(nextPages);
      setLineIdsByFamily(nextLineIds);
    } catch (loadError) {
      console.error(loadError);
      setError('Não foi possível carregar as famílias.');
      setFamilias([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const linhasPorId = useMemo(
    () => new Map(linhas.map((linha) => [linha.id, linha])),
    [linhas]
  );

  async function setFamilyActive(familia) {
    const action = familia.ativo ? 'desativar' : 'ativar';
    if (!window.confirm(`${action[0].toUpperCase()}${action.slice(1)} a família ${familia.nome}?`)) return;

    setSaving(true);
    setError('');
    try {
      const linhaIds = (lineIdsByFamily.get(familia.id) ?? [])
        .filter((id) => linhas.some((linha) => linha.id === id));
      const paginas = pagesByFamily.get(familia.id) ?? [];

      await saveFamilyRpc({
        familiaId: familia.id,
        familia: { ...familia, ativo: !familia.ativo },
        linhaIds,
        paginas,
      });
      await loadData();
    } catch (updateError) {
      console.error(updateError);
      await loadData();
      setError(updateError?.message || 'Não foi possível alterar o status da família.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteFamily(familia) {
    if (!window.confirm(`Excluir a família ${familia.nome}? Esta ação não pode ser desfeita.`)) return;

    setSaving(true);
    setError('');
    try {
      const { error: familyError } = await supabase
        .from('catalogo_familias')
        .delete()
        .eq('id', familia.id);
      if (familyError) throw familyError;

      await loadData();
    } catch (deleteError) {
      console.error(deleteError);
      await loadData();
      setError('Não foi possível excluir a família. Os dados foram recarregados.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="admin2-empty-state">Carregando famílias...</div>;
  }

  return (
    <section className="admin2-families">
      <div className="admin2-section-heading">
        <div>
          <h2>Famílias</h2>
          <p>Gerencie as famílias, suas páginas e as linhas de origem.</p>
        </div>
        <div className="admin2-section-actions">
          <div className="admin2-categories-summary">{familias.length} famílias</div>
          <button type="button" className="admin2-primary-button" onClick={() => setEditing({ familia: null })}>
            + Nova família
          </button>
        </div>
      </div>

      {error && <div className="admin2-empty-state admin2-empty-state-error">{error}</div>}

      <div className="admin2-table-card admin2-families-table-wrap">
        <table className="admin2-families-table">
          <thead><tr><th>Capa</th><th>Família</th><th>Aplicação</th><th>Páginas</th><th>Linhas</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            {familias.length === 0 ? <tr><td colSpan="7" className="admin2-table-empty">Nenhuma família cadastrada.</td></tr> : familias.map((familia) => {
              const paginas = pagesByFamily.get(familia.id) ?? [];
              const capa = paginas.find((pagina) => Number(pagina.ordem) === 0) ?? paginas[0];
              const familyLines = (lineIdsByFamily.get(familia.id) ?? []).map((id) => linhasPorId.get(id)?.nome).filter(Boolean);
              return <tr key={familia.id}>
                <td><div className="admin2-family-cover">{capa?.imagem_url ? <img src={capa.imagem_url} alt="" /> : <span>Sem capa</span>}</div></td>
                <td><strong>{familia.nome}</strong><small>Ordem {familia.ordem ?? 0}</small></td>
                <td><strong>{familia.marca || '—'}</strong><small>{[familia.veiculo, familia.anos].filter(Boolean).join(' · ') || '—'}</small></td>
                <td>{paginas.length}</td>
                <td className="admin2-family-lines">{familyLines.length ? familyLines.join(', ') : '—'}</td>
                <td><span className={familia.ativo ? 'admin2-status admin2-status-active' : 'admin2-status admin2-status-inactive'}>{familia.ativo ? 'Ativa' : 'Inativa'}</span></td>
                <td><div className="admin2-family-actions"><button type="button" className="admin2-link-button" onClick={() => setEditing({ familia, paginas, linhaIds: lineIdsByFamily.get(familia.id) ?? [] })}>Editar</button><button type="button" className="admin2-link-button" onClick={() => setFamilyActive(familia)} disabled={saving}>{familia.ativo ? 'Desativar' : 'Ativar'}</button><button type="button" className="admin2-link-button is-danger" onClick={() => deleteFamily(familia)} disabled={saving}>Excluir</button></div></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>

      {editing && <FamilyModal familia={editing.familia} initialPages={editing.paginas} initialLineIds={editing.linhaIds} linhas={linhas} session={session} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await loadData(); }} />}
    </section>
  );
}

function FamilyModal({ familia, initialPages = [], initialLineIds = [], linhas, session, onClose, onSaved }) {
  const isEdit = Boolean(familia?.id);
  const products = useFamilyProducts(familia?.id);
  const [brandSelected, setBrandSelected] = useState(Boolean(familia?.marca));
  const [draft, setDraft] = useState(() => makeDraft(familia));
  const [selectedLineIds, setSelectedLineIds] = useState(initialLineIds);
  const [pages, setPages] = useState(() => {
    const sorted = [...initialPages].sort((a, b) => Number(a.ordem) - Number(b.ordem));
    return sorted.length
      ? sorted.map((page) => ({ ...EMPTY_PAGE(), ...page, preview_url: '' }))
      : [EMPTY_PAGE()];
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const previewUrlsRef = useRef(new Set());

  function revokePreviewUrl(url) {
    if (!url || !previewUrlsRef.current.has(url)) return;

    URL.revokeObjectURL(url);
    previewUrlsRef.current.delete(url);
  }

  useEffect(() => () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current.clear();
  }, []);

  function updatePage(index, patch) {
    setPages((current) => current.map((page, pageIndex) => pageIndex === index ? { ...page, ...patch } : page));
  }

  function setFile(index, file) {
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    previewUrlsRef.current.add(previewUrl);

    setPages((current) => current.map((page, pageIndex) => {
      if (pageIndex !== index) return page;
      revokePreviewUrl(page.preview_url);
      return { ...page, file, preview_url: previewUrl };
    }));
  }

  function removePage(index) {
    setPages((current) => {
      const page = current[index];
      revokePreviewUrl(page?.preview_url);
      return current.filter((_, pageIndex) => pageIndex !== index);
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving || products.status !== 'ready') return setError('Aguarde o carregamento completo dos vínculos ou tente novamente.');
    const nome = draft.nome.trim();
    const selectedLines = selectedLineIds
      .map((id) => linhas.find((linha) => linha.id === id))
      .filter(Boolean);
    const pagesForSave = pages.filter((page) => page.file || page.imagem_url);
    const hasCover = pages[0]?.file || pages[0]?.imagem_url;
    const coverIsActive = Boolean(pages[0]?.ativo);

    if (!nome) return setError('Informe o nome da família.');
    if (!brandSelected || !draft.marca.trim()) return setError('Selecione uma marca na lista de opções.');
    if (!draft.veiculo.trim()) return setError('Informe o veículo.');
    if (draft.ativo && !selectedLines.length) return setError('Selecione ao menos uma Linha ativa.');
    if (draft.ativo && selectedLines.some((linha) => !linha.ativo)) return setError('Famílias ativas só podem usar Linhas ativas.');
    if (draft.ativo && !hasCover) return setError('Envie a imagem principal da família.');
    if (draft.ativo && !coverIsActive) return setError('A capa de uma Família ativa deve estar ativa.');
    if (!hasCover && pagesForSave.length) return setError('A imagem principal deve ocupar a posição de capa.');
    if (!session?.access_token) return setError('Sua sessão expirou. Entre novamente para enviar imagens.');

    setSaving(true);
    setError('');
    try {
      const uploadedPages = await Promise.all(pagesForSave.map(async (page) => ({
        ...page,
        imagem_url: page.file ? await uploadFamilyImage(session, page.file) : page.imagem_url,
      })));
      await saveFamilyRpc({
        familiaId: familia?.id ?? null,
        familia: { ...draft, nome },
        linhaIds: selectedLineIds,
        paginas: uploadedPages,
        produtoIds: products.changed ? products.ids : undefined,
      });
      await onSaved();
    } catch (saveError) {
      console.error(saveError);
      setError(saveError?.message || 'Não foi possível salvar. Suas alterações foram preservadas; tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return <div className="admin2-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <div className="admin2-family-modal">
      <div className="admin2-category-modal-header"><div><h2>{isEdit ? 'Editar família' : 'Nova família'}</h2><p>A primeira página é a capa e sempre recebe ordem zero.</p></div><button type="button" className="admin2-modal-close" onClick={onClose} disabled={saving}>×</button></div>
      <form onSubmit={handleSubmit}>
        <div className="admin2-family-modal-body">
          {error && <div className="admin2-category-modal-error">{error}</div>}
          <fieldset className="admin2-family-edit-fields" disabled={saving}>
          <div className="admin2-family-fields admin2-family-fields-primary">
            <FamilyBrandPicker showError={error === 'Selecione uma marca na lista de opções.'} selected={brandSelected} value={draft.marca} disabled={saving} onValidityChange={setBrandSelected} onChange={(marca) => setDraft((current) => ({ ...current, marca }))} />
            {[['nome', 'Nome da família', 'Ex.: Linha Premium'], ['veiculo', 'Veículo', 'Ex.: Caminhão']].map(([key, label, placeholder]) => <label className="admin2-field" key={key}><span>{label}</span><input value={draft[key]} placeholder={placeholder} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
          </div>
          <div className="admin2-family-fields admin2-family-fields-secondary">
            <label className="admin2-field"><span>Anos</span><input value={draft.anos} placeholder="Ex.: 2018–2024" onChange={(event) => setDraft((current) => ({ ...current, anos: event.target.value }))} /></label>
            <label className="admin2-field"><span>Ordem</span><input type="number" value={draft.ordem} onChange={(event) => setDraft((current) => ({ ...current, ordem: event.target.value }))} /></label>
            <label className="admin2-category-status-toggle admin2-family-status"><input type="checkbox" checked={draft.ativo} onChange={(event) => setDraft((current) => ({ ...current, ativo: event.target.checked }))} /><span><strong>Família ativa</strong></span></label>
          </div>
          <fieldset className="admin2-family-line-picker"><legend>Linhas de origem</legend><div>{linhas.map((linha) => <label key={linha.id}><input type="checkbox" checked={selectedLineIds.includes(linha.id)} onChange={(event) => setSelectedLineIds((current) => event.target.checked ? [...current, linha.id] : current.filter((id) => id !== linha.id))} /> {linha.nome}{!linha.ativo && ' (inativa)'}</label>)}</div></fieldset>
          <FamilyProductsPicker selection={products} disabled={saving} />
          <div className="admin2-family-pages"><div className="admin2-family-pages-heading"><div><h3>Páginas e imagens</h3><p>Primeira imagem: capa.</p></div><button type="button" className="admin2-secondary-button" onClick={() => setPages((current) => [...current, EMPTY_PAGE()])} disabled={saving}>+ Página</button></div>{pages.map((page, index) => <div className="admin2-family-page" key={page.id ?? page.clientId}><div className="admin2-family-page-image">{page.preview_url || page.imagem_url ? <img src={page.preview_url || page.imagem_url} alt="" /> : <span>Sem imagem</span>}</div><div className="admin2-family-page-fields"><strong>{index === 0 ? 'Capa (ordem 0)' : `Página ${index} (ordem ${index})`}</strong><label className="admin2-field"><span>Título</span><input value={page.titulo ?? ''} onChange={(event) => updatePage(index, { titulo: event.target.value })} placeholder={index === 0 ? 'Título da capa (opcional)' : 'Título da página (opcional)'} /></label><label className="admin2-family-upload"><input type="file" accept="image/*" onChange={(event) => { setFile(index, event.target.files?.[0]); event.target.value = ''; }} />{page.preview_url || page.imagem_url ? 'Trocar imagem' : 'Enviar imagem'}</label><label className="admin2-family-page-active"><input type="checkbox" checked={page.ativo} onChange={(event) => updatePage(index, { ativo: event.target.checked })} /> Página ativa</label></div><div className="admin2-family-page-actions"><button type="button" className="admin2-secondary-button" disabled={saving || index <= 1} onClick={() => setPages((current) => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })}>↑</button><button type="button" className="admin2-secondary-button" disabled={saving || index === 0 || index === pages.length - 1} onClick={() => setPages((current) => { const next = [...current]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; return next; })}>↓</button>{index > 0 && <button type="button" className="admin2-link-button is-danger" disabled={saving} onClick={() => removePage(index)}>Remover</button>}</div></div>)}</div>
          </fieldset>
        </div>
        <div className="admin2-category-modal-footer"><button type="button" className="admin2-secondary-button" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" className="admin2-primary-button" disabled={saving || products.status !== 'ready' || !brandSelected}>{saving ? 'Salvando...' : 'Salvar família'}</button></div>
      </form>
    </div>
  </div>;
}
