import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import '../styles/admin.css';

const LINHAS = ['Leve', 'Van', 'Pesada'];

function normalize(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function emptyAplicacao() {
  return { veiculo: '', ano_apos: '', ate: '' };
}

async function uploadFile(session, file, folder) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  const res = await fetch(`${import.meta.env.VITE_API_URL}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Falha no upload da imagem.');
  return data.url;
}

function ProductModal({ produto, marcas, categorias, onClose, onSaved, uploadPhoto }) {
  const isEdit = !!produto;
  const [codigo, setCodigo] = useState(produto?.codigo ?? '');
  const [original, setOriginal] = useState(produto?.original ?? '');
  const [marca, setMarca] = useState(produto?.marca ?? marcas[0] ?? '');
  const [novaMarca, setNovaMarca] = useState('');
  const [categoria, setCategoria] = useState(produto?.categoria ?? categorias[0] ?? '');
  const [novaCategoria, setNovaCategoria] = useState('');
  const [descricao, setDescricao] = useState(produto?.descricao ?? '');
  const [numeroConversao, setNumeroConversao] = useState(produto?.numero_conversao ?? '');
  const [aplicacoes, setAplicacoes] = useState(
    produto?.aplicacoes?.length
      ? produto.aplicacoes.map((a) => ({ veiculo: a.veiculo || '', ano_apos: a.ano_apos || '', ate: a.ate || '' }))
      : [emptyAplicacao()]
  );
  const [pesoLiquido, setPesoLiquido] = useState(produto?.peso_liquido ?? '');
  const [barras, setBarras] = useState(produto?.barras ?? '');
  const [preco, setPreco] = useState(produto?.preco ?? '');
  const [linhas, setLinhas] = useState(
    produto?.linha ? produto.linha.split(',').map((s) => s.trim()).filter(Boolean) : []
  );
  const [fotoUrl, setFotoUrl] = useState(produto?.foto_local ?? '');
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(produto?.foto_local ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function updateAplicacao(i, field, value) {
    setAplicacoes((rows) => rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }
  function removeAplicacao(i) {
    setAplicacoes((rows) => (rows.length > 1 ? rows.filter((_, idx) => idx !== i) : [emptyAplicacao()]));
  }

  function toggleLinha(l) {
    setLinhas((ls) => (ls.includes(l) ? ls.filter((x) => x !== l) : [...ls, l]));
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const marcaFinal = marca === '__new__' ? novaMarca.trim() : marca;
    const categoriaFinal = categoria === '__new__' ? novaCategoria.trim() : categoria;
    if (!codigo.trim() || !marcaFinal || !categoriaFinal || !descricao.trim()) {
      setError('Código, marca, categoria e descrição são obrigatórios.');
      return;
    }

    setSaving(true);
    try {
      let finalFotoUrl = fotoUrl;
      if (fotoFile) {
        finalFotoUrl = await uploadPhoto(fotoFile);
      }

      const aplicacoesLimpas = aplicacoes
        .filter((a) => a.veiculo || a.ano_apos || a.ate)
        .map((a) => ({ veiculo: a.veiculo.trim(), ano_apos: a.ano_apos.trim(), ate: a.ate.trim(), geracao: '', portas: '', obs: '' }));

      const payload = {
        codigo: codigo.trim(),
        original: original.trim() || null,
        marca: marcaFinal,
        categoria: categoriaFinal,
        descricao: descricao.trim(),
        aplicacoes: aplicacoesLimpas,
        numero_conversao: numeroConversao.trim() || null,
        peso_liquido: pesoLiquido.trim() || null,
        barras: barras.trim() || null,
        preco: preco !== '' ? parseFloat(preco) : null,
        linha: linhas.join(', ') || null,
        foto_local: finalFotoUrl || null,
        foto_local_gde: finalFotoUrl || null,
      };

      if (isEdit) {
        const { error } = await supabase.from('produtos').update(payload).eq('id', produto.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('produtos').insert({ ...payload, aplicacao_revisar: false, ativo: true });
        if (error) throw error;
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal">
        <h2>{isEdit ? 'Editar produto' : 'Novo produto'}</h2>
        <p className="admin-modal-sub">Campos com * são obrigatórios.</p>
        <form onSubmit={handleSubmit}>
          <div className="photo-upload">
            <div className={`photo-preview ${fotoPreview ? '' : 'empty'}`}>
              {fotoPreview ? <img src={fotoPreview} alt="" /> : 'sem foto'}
            </div>
            <div className="field" style={{ marginBottom: 0, flex: 1 }}>
              <label>Foto do produto</label>
              <input type="file" accept="image/*" onChange={handlePhotoChange} />
            </div>
          </div>

          <div className="field-grid" style={{ marginTop: 12 }}>
            <div className="field">
              <label>Código Ori *</label>
              <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
            </div>
            <div className="field">
              <label>Código original</label>
              <input type="text" value={original} onChange={(e) => setOriginal(e.target.value)} />
            </div>
          </div>

          <div className="field-grid field-grid-3">
            <div className="field">
              <label>Marca *</label>
              <select value={marca} onChange={(e) => setMarca(e.target.value)} required>
                {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
                <option value="__new__">+ Adicionar nova...</option>
              </select>
              {marca === '__new__' && (
                <input type="text" placeholder="Nome da marca" value={novaMarca} onChange={(e) => setNovaMarca(e.target.value)} style={{ marginTop: 6 }} required />
              )}
            </div>
            <div className="field">
              <label>Categoria *</label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)} required>
                {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="__new__">+ Adicionar nova...</option>
              </select>
              {categoria === '__new__' && (
                <input type="text" placeholder="Nome da categoria" value={novaCategoria} onChange={(e) => setNovaCategoria(e.target.value)} style={{ marginTop: 6 }} required />
              )}
            </div>
            <div className="field">
              <label>Código de conversão</label>
              <input type="text" value={numeroConversao} onChange={(e) => setNumeroConversao(e.target.value)} />
            </div>
          </div>

          <div className="field-grid">
            <div className="field full">
              <label>Descrição *</label>
              <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} required placeholder="Ex: Fecho Inferior do Capô - Gol GI 88 a 94" />
            </div>
            <div className="field full">
              <label>Veículos compatíveis <span className="dim">(um por veículo)</span></label>
              {aplicacoes.map((a, i) => (
                <div className="aplicacao-row" key={i}>
                  <input type="text" placeholder="Veículo" value={a.veiculo} onChange={(e) => updateAplicacao(i, 'veiculo', e.target.value)} />
                  <input type="text" placeholder="Ano a partir de" value={a.ano_apos} onChange={(e) => updateAplicacao(i, 'ano_apos', e.target.value)} />
                  <input type="text" placeholder="Ano até" value={a.ate} onChange={(e) => updateAplicacao(i, 'ate', e.target.value)} />
                  <button type="button" className="remove-row-btn" onClick={() => removeAplicacao(i)}>&times;</button>
                </div>
              ))}
              <button type="button" className="add-row-btn" onClick={() => setAplicacoes((rows) => [...rows, emptyAplicacao()])}>+ Adicionar veículo</button>
            </div>
            <div className="field full field-row-peso-barras">
              <div className="field">
                <label>Peso líquido</label>
                <input type="text" placeholder="Ex: 0,154 kg" value={pesoLiquido} onChange={(e) => setPesoLiquido(e.target.value)} />
              </div>
              <div className="field">
                <label>Código de barras</label>
                <input type="text" value={barras} onChange={(e) => setBarras(e.target.value)} />
              </div>
            </div>
            <div className="field full">
              <label>Preço (uso futuro — ainda não aparece pro cliente)</label>
              <input type="number" step="0.01" min="0" placeholder="0,00" value={preco} onChange={(e) => setPreco(e.target.value)} />
            </div>
            <div className="field full">
              <label>Linha(s)</label>
              <div className="linha-checks">
                {LINHAS.map((l) => (
                  <label key={l}>
                    <input type="checkbox" checked={linhas.includes(l)} onChange={() => toggleLinha(l)} /> {l}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {error && <div className="admin-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-save" disabled={saving}>{saving ? 'Salvando...' : 'Salvar produto'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProdutosTab() {
  const { session } = useAuth();
  const [produtos, setProdutos] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new, object = edit
  const [toast, setToast] = useState('');

  async function loadFiltros() {
    const { data } = await supabase.from('produtos').select('marca, categoria').limit(4000);
    setMarcas([...new Set((data ?? []).map((p) => p.marca).filter(Boolean))].sort());
    setCategorias([...new Set((data ?? []).map((p) => p.categoria).filter(Boolean))].sort());
  }

  async function loadProdutos() {
    setLoading(true);
    let query = supabase.from('produtos').select('*').order('codigo').limit(60);
    if (search.trim()) {
      const q = search.trim();
      query = query.or(`descricao.ilike.%${q}%,codigo.ilike.%${q}%,marca.ilike.%${q}%`);
    }
    const { data, error } = await query;
    if (error) console.error(error);
    setProdutos(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadFiltros(); }, []);
  useEffect(() => {
    const t = setTimeout(loadProdutos, 250);
    return () => clearTimeout(t);
  }, [search]);

  async function uploadPhoto(file) {
    return uploadFile(session, file, 'produtos');
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function handleSaved() {
    setEditing(undefined);
    loadFiltros();
    loadProdutos();
    showToast('Produto salvo.');
  }

  async function handleDelete(p) {
    if (!window.confirm(`Excluir o produto "${p.descricao}" (Cód. ${p.codigo})? Essa ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from('produtos').delete().eq('id', p.id);
    if (error) {
      showToast(`Erro ao excluir: ${error.message}`);
      return;
    }
    loadFiltros();
    loadProdutos();
    showToast('Produto excluído.');
  }

  return (
    <div>
      <div className="admin-toolbar">
        <input type="text" placeholder="Buscar por código, marca ou descrição..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="button" className="new-btn" onClick={() => setEditing(null)}>+ Novo produto</button>
      </div>

      <div className="admin-list">
        {loading ? (
          <p className="dim">Carregando...</p>
        ) : produtos.length === 0 ? (
          <p className="dim">Nenhum produto encontrado.</p>
        ) : (
          produtos.map((p) => (
            <div className="admin-row" key={p.id}>
              <img src={p.foto_local || ''} alt="" onError={(e) => { e.target.style.visibility = 'hidden'; }} />
              <div className="info">
                <div className="desc">{p.descricao}</div>
                <div className="meta">{p.marca} — Cód. {p.codigo}{p.linha ? ` — Linha ${p.linha}` : ''}</div>
              </div>
              <button type="button" className="edit-btn" onClick={() => setEditing(p)}>Editar</button>
              <button type="button" className="delete-btn" onClick={() => handleDelete(p)}>Excluir</button>
            </div>
          ))
        )}
        {produtos.length === 60 && <p className="hint">Mostrando os primeiros 60 resultados — refine a busca pra achar outros.</p>}
      </div>

      {editing !== undefined && (
        <ProductModal
          produto={editing}
          marcas={marcas}
          categorias={categorias}
          onClose={() => setEditing(undefined)}
          onSaved={handleSaved}
          uploadPhoto={uploadPhoto}
        />
      )}

      {toast && <div className="admin-toast show">{toast}</div>}
    </div>
  );
}

const MAX_DESTAQUE_CATEGORIAS = 5;
const MAX_DESTAQUE_PRODUTOS = 3;

function emptySlot() {
  return { categoria: '', produtoIds: [] };
}

function DestaqueSlot({ slot, index, categorias, categoriasUsadas, onChangeCategoria, onRemove, onAddProduto, onRemoveProduto }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!slot.categoria) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(() => {
      let query = supabase
        .from('produtos')
        .select('id, codigo, marca, descricao, foto_local')
        .eq('categoria', slot.categoria)
        .order('codigo')
        .limit(12);
      if (search.trim()) {
        query = query.or(`descricao.ilike.%${search.trim()}%,codigo.ilike.%${search.trim()}%`);
      }
      query.then(({ data }) => {
        setResults((data ?? []).filter((p) => !slot.produtoIds.includes(p.id)));
        setSearching(false);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [search, slot.categoria, slot.produtoIds]);

  const categoriasDisponiveis = categorias.filter((c) => c === slot.categoria || !categoriasUsadas.includes(c));

  return (
    <div className="destaque-slot">
      <div className="destaque-slot-head">
        <select value={slot.categoria} onChange={(e) => onChangeCategoria(index, e.target.value)}>
          <option value="">Escolher categoria...</option>
          {categoriasDisponiveis.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="button" className="remove-row-btn" onClick={() => onRemove(index)}>&times;</button>
      </div>

      {slot.categoria && (
        <>
          <div className="destaque-produtos">
            {slot.produtos.map((p) => (
              <div className="destaque-produto-chip" key={p.id}>
                <img src={p.foto_local || ''} alt="" onError={(e) => { e.target.style.visibility = 'hidden'; }} />
                <span>{p.descricao}</span>
                <button type="button" onClick={() => onRemoveProduto(index, p.id)}>&times;</button>
              </div>
            ))}
            {slot.produtos.length === 0 && <p className="dim" style={{ fontSize: 12.5 }}>Nenhum produto escolhido ainda (até {MAX_DESTAQUE_PRODUTOS}).</p>}
          </div>

          {slot.produtoIds.length < MAX_DESTAQUE_PRODUTOS && (
            <div className="destaque-search">
              <input
                type="text"
                placeholder={`Buscar produto em "${slot.categoria}"...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="destaque-results">
                {searching ? (
                  <p className="dim" style={{ padding: 8, fontSize: 12.5 }}>Buscando...</p>
                ) : results.length === 0 ? (
                  <p className="dim" style={{ padding: 8, fontSize: 12.5 }}>Nenhum produto encontrado.</p>
                ) : (
                  results.map((p) => (
                    <button type="button" key={p.id} onClick={() => onAddProduto(index, p)}>
                      <img src={p.foto_local || ''} alt="" onError={(e) => { e.target.style.visibility = 'hidden'; }} />
                      <span>{p.descricao} — Cód. {p.codigo}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DestaquesTab() {
  const { session } = useAuth();
  const [categorias, setCategorias] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: prodData }, { data: conteudo }] = await Promise.all([
        supabase.from('produtos').select('categoria').eq('ativo', true).limit(4000),
        supabase.from('conteudo_site').select('valor').eq('chave', 'destaques').maybeSingle(),
      ]);
      setCategorias([...new Set((prodData ?? []).map((p) => p.categoria).filter(Boolean))].sort());

      const salvos = conteudo?.valor ?? [];
      if (salvos.length === 0) {
        setSlots([]);
        setLoading(false);
        return;
      }
      const ids = salvos.flatMap((s) => s.produto_ids ?? []);
      const { data: produtos } = ids.length
        ? await supabase.from('produtos').select('id, codigo, marca, descricao, foto_local').in('id', ids)
        : { data: [] };
      const byId = new Map((produtos ?? []).map((p) => [p.id, p]));
      setSlots(
        salvos.map((s) => ({
          categoria: s.categoria,
          produtoIds: s.produto_ids ?? [],
          produtos: (s.produto_ids ?? []).map((id) => byId.get(id)).filter(Boolean),
        }))
      );
      setLoading(false);
    }
    load();
  }, []);

  function addSlot() {
    setSlots((s) => (s.length >= MAX_DESTAQUE_CATEGORIAS ? s : [...s, { ...emptySlot(), produtos: [] }]));
  }
  function removeSlot(i) {
    setSlots((s) => s.filter((_, idx) => idx !== i));
  }
  function changeCategoria(i, categoria) {
    setSlots((s) => s.map((slot, idx) => (idx === i ? { categoria, produtoIds: [], produtos: [] } : slot)));
  }
  function addProduto(i, produto) {
    setSlots((s) =>
      s.map((slot, idx) =>
        idx === i && slot.produtoIds.length < MAX_DESTAQUE_PRODUTOS
          ? { ...slot, produtoIds: [...slot.produtoIds, produto.id], produtos: [...slot.produtos, produto] }
          : slot
      )
    );
  }
  function removeProduto(i, produtoId) {
    setSlots((s) =>
      s.map((slot, idx) =>
        idx === i
          ? { ...slot, produtoIds: slot.produtoIds.filter((id) => id !== produtoId), produtos: slot.produtos.filter((p) => p.id !== produtoId) }
          : slot
      )
    );
  }

  async function handleSave() {
    setSaving(true);
    const valor = slots.filter((s) => s.categoria).map((s) => ({ categoria: s.categoria, produto_ids: s.produtoIds }));
    const { error } = await supabase
      .from('conteudo_site')
      .upsert({ chave: 'destaques', valor, updated_at: new Date().toISOString(), updated_by: session.user.id });
    setSaving(false);
    if (error) { showToast(`Erro ao salvar: ${error.message}`); return; }
    showToast('Destaques da Home atualizados.');
  }

  if (loading) return <div className="admin-list"><p className="dim">Carregando...</p></div>;

  const categoriasUsadas = slots.map((s) => s.categoria).filter(Boolean);

  return (
    <div className="admin-list">
      <p className="hint" style={{ marginBottom: 14 }}>
        Escolha até {MAX_DESTAQUE_CATEGORIAS} categorias e até {MAX_DESTAQUE_PRODUTOS} produtos em cada uma pra aparecer na vitrine "Produtos em destaque" da Home.
      </p>

      {slots.map((slot, i) => (
        <DestaqueSlot
          key={i}
          slot={slot}
          index={i}
          categorias={categorias}
          categoriasUsadas={categoriasUsadas}
          onChangeCategoria={changeCategoria}
          onRemove={removeSlot}
          onAddProduto={addProduto}
          onRemoveProduto={removeProduto}
        />
      ))}

      {slots.length < MAX_DESTAQUE_CATEGORIAS && (
        <button type="button" className="add-row-btn" onClick={addSlot}>+ Adicionar categoria</button>
      )}

      <div className="modal-actions" style={{ marginTop: 20 }}>
        <button type="button" className="btn-save" style={{ flex: 'none', padding: '10px 20px' }} disabled={saving} onClick={handleSave}>
          {saving ? 'Salvando...' : 'Salvar destaques'}
        </button>
      </div>

      {toast && <div className="admin-toast show">{toast}</div>}
    </div>
  );
}

function ImageListTab({ chave, description, hint, folder, itemLabel }) {
  const { session } = useAuth();
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState('');

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  useEffect(() => {
    supabase.from('conteudo_site').select('valor').eq('chave', chave).maybeSingle().then(({ data }) => {
      setImages(data?.valor ?? []);
      setLoading(false);
    });
  }, [chave]);

  async function persist(next) {
    setImages(next);
    const { error } = await supabase
      .from('conteudo_site')
      .upsert({ chave, valor: next, updated_at: new Date().toISOString(), updated_by: session.user.id });
    if (error) showToast(`Erro ao salvar: ${error.message}`);
  }

  async function handleFile(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(session, file, folder);
      await persist([...images, url]);
      showToast(`${itemLabel} adicionado.`);
    } catch (err) {
      showToast(err.message);
    } finally {
      setUploading(false);
    }
  }

  function moveUp(i) {
    if (i === 0) return;
    const next = [...images];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    persist(next);
  }
  function moveDown(i) {
    if (i === images.length - 1) return;
    const next = [...images];
    [next[i + 1], next[i]] = [next[i], next[i + 1]];
    persist(next);
  }
  function remove(i) {
    if (!window.confirm(`Remover este ${itemLabel.toLowerCase()}?`)) return;
    persist(images.filter((_, idx) => idx !== i));
  }

  if (loading) return <div className="admin-list"><p className="dim">Carregando...</p></div>;

  return (
    <div className="admin-list">
      <p className="hint" style={{ marginBottom: 4 }}>{description}</p>
      <div className="admin-hint-warn">{hint}</div>

      <label className="new-btn" style={{ display: 'inline-block', marginBottom: 14, cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.6 : 1 }}>
        {uploading ? 'Enviando...' : `+ Adicionar ${itemLabel.toLowerCase()}`}
        <input type="file" accept="image/*" onChange={handleFile} disabled={uploading} style={{ display: 'none' }} />
      </label>

      {images.length === 0 ? (
        <p className="dim">Nenhum {itemLabel.toLowerCase()} cadastrado.</p>
      ) : (
        images.map((src, i) => (
          <div className="admin-row" key={src + i}>
            <img src={src} alt="" onError={(e) => { e.target.style.visibility = 'hidden'; }} />
            <div className="info">
              <div className="desc">{itemLabel} {i + 1}</div>
              <div className="meta">{i === 0 ? 'Primeiro a aparecer' : `Posição ${i + 1}`}</div>
            </div>
            <button type="button" className="edit-btn" disabled={i === 0} onClick={() => moveUp(i)}>↑</button>
            <button type="button" className="edit-btn" disabled={i === images.length - 1} onClick={() => moveDown(i)}>↓</button>
            <button type="button" className="delete-btn" onClick={() => remove(i)}>Remover</button>
          </div>
        ))
      )}

      {toast && <div className="admin-toast show">{toast}</div>}
    </div>
  );
}

function csvEscape(value) {
  const s = (value ?? '').toString();
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function LeadsTab() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (error) console.error(error);
        setLeads(data ?? []);
        setLoading(false);
      });
  }, []);

  function exportCsv() {
    const header = ['Nome', 'E-mail', 'Telefone', 'Empresa', 'Região', 'Origem', 'Peças selecionadas', 'Data'];
    const rows = leads.map((l) => [
      l.nome,
      l.email,
      l.telefone,
      l.empresa,
      l.regiao,
      l.origem,
      (l.produtos_selecionados ?? []).length,
      new Date(l.created_at).toLocaleString('pt-br'),
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-ori-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="admin-list"><p className="dim">Carregando...</p></div>;

  return (
    <div className="admin-list">
      <div className="admin-toolbar" style={{ position: 'static' }}>
        <span style={{ flex: 1, fontSize: 13.5, color: 'var(--text-dim)' }}>{leads.length} lead{leads.length === 1 ? '' : 's'} capturado{leads.length === 1 ? '' : 's'} (baixaram catálogo em PDF)</span>
        <button type="button" className="new-btn" onClick={exportCsv} disabled={leads.length === 0}>Exportar CSV</button>
      </div>

      {leads.length === 0 ? (
        <p className="dim" style={{ marginTop: 14 }}>Nenhum lead capturado ainda.</p>
      ) : (
        leads.map((l) => (
          <div className="admin-row" key={l.id} style={{ alignItems: 'flex-start' }}>
            <div className="info">
              <div className="desc">{l.nome}</div>
              <div className="meta">
                {l.email}{l.telefone ? ` — ${l.telefone}` : ''}{l.empresa ? ` — ${l.empresa}` : ''}{l.regiao ? ` — ${l.regiao}` : ''}
              </div>
              <div className="meta">
                {(l.produtos_selecionados ?? []).length} peça{(l.produtos_selecionados ?? []).length === 1 ? '' : 's'} selecionada{(l.produtos_selecionados ?? []).length === 1 ? '' : 's'} · {new Date(l.created_at).toLocaleString('pt-br')}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export function Admin() {
  const [tab, setTab] = useState('produtos');

  return (
    <div className="admin-page">
      <header className="admin-header">
        <Link className="admin-back" to="/">← Voltar ao site</Link>
        <h1><span className="admin-logo-badge"><img src="/assets/logo.png" alt="" /></span>Painel Admin</h1>
        <p>Cadastro de produtos e destaques do site.</p>
        <div className="admin-tabs">
          <button type="button" className={tab === 'produtos' ? 'active' : ''} onClick={() => setTab('produtos')}>Produtos</button>
          <button type="button" className={tab === 'destaques' ? 'active' : ''} onClick={() => setTab('destaques')}>Destaques</button>
          <button type="button" className={tab === 'banners' ? 'active' : ''} onClick={() => setTab('banners')}>Banners</button>
          <button type="button" className={tab === 'instagram' ? 'active' : ''} onClick={() => setTab('instagram')}>Instagram</button>
          <button type="button" className={tab === 'leads' ? 'active' : ''} onClick={() => setTab('leads')}>Leads</button>
        </div>
      </header>

      {tab === 'produtos' && <ProdutosTab />}
      {tab === 'destaques' && <DestaquesTab />}
      {tab === 'leads' && <LeadsTab />}
      {tab === 'banners' && (
        <ImageListTab
          chave="banners"
          folder="banners"
          itemLabel="Banner"
          description="Banners rotativos da página inicial, logo abaixo de &quot;Monte seu Catálogo&quot;."
          hint={<><b>Tamanho recomendado:</b> proporção larga 1140 × 340px (ou múltiplo, ex: 1600 × 477px) — JPG ou PNG, de preferência abaixo de 500KB. A ordem da lista é a ordem de exibição no carrossel.</>}
        />
      )}
      {tab === 'instagram' && (
        <ImageListTab
          chave="instagram"
          folder="instagram"
          itemLabel="Foto"
          description="Fotos da seção &quot;Acompanhe — Siga a Ori no Instagram&quot; na página inicial."
          hint={<><b>Tamanho recomendado:</b> proporção 4×5 (ex: 1080 × 1350px, padrão de post do Instagram) — JPG ou PNG. A ordem da lista é a ordem de exibição na grade.</>}
        />
      )}
    </div>
  );
}
