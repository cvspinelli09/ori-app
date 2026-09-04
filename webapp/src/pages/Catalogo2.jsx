import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import '../styles/catalogo2.css';

const PENDING_SELECTION_KEY = 'catalogo2_pending_selection';

function buildFiltrosSnapshot({ selectedCategories, selectedLines, selectedBrands, applicationSearch, codeOriSearch, conversionSearch, barcodeSearch, sortBy }) {
  return {
    categories: selectedCategories,
    lines: selectedLines,
    brands: selectedBrands,
    application: applicationSearch,
    code: codeOriSearch,
    conversion: conversionSearch,
    barcode: barcodeSearch,
    sortBy,
  };
}

function sameFiltros(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Reaplica a mesma lógica de matchesSearch/filtro usada em filteredList, mas contra um
// filtros arbitrário (de uma seleção salva) em vez do estado atual da página — usado só
// pra calcular "N produtos atualmente" em Minhas seleções, sem duplicar a árvore de estado.
function countMatchingProducts(produtos, filtros) {
  if (!filtros) return 0;
  let list = produtos;

  if (filtros.categories?.length) {
    list = list.filter((p) => filtros.categories.includes(p.categoria));
  }
  if (filtros.brands?.length) {
    list = list.filter((p) => filtros.brands.includes(p.marca));
  }
  if (filtros.lines?.length) {
    list = list.filter((p) => {
      const linhasProduto = (p.linha || '').split(',').map((l) => l.trim()).filter(Boolean);
      return linhasProduto.some((linha) => filtros.lines.includes(linha));
    });
  }
  if (filtros.application?.trim()) {
    const q = normalize(filtros.application);
    list = list.filter((p) => {
      const applications = Array.isArray(p.aplicacoes) ? p.aplicacoes : [];
      return applications.some((app) =>
        [app.veiculo, app.geracao, app.portas, app.ano_apos, app.ate, app.obs].some((v) => normalize(v).includes(q))
      );
    });
  }
  if (filtros.code?.trim()) {
    const q = normalize(filtros.code);
    list = list.filter((p) => normalize(p.codigo).includes(q));
  }
  if (filtros.conversion?.trim()) {
    const q = normalize(filtros.conversion);
    list = list.filter((p) => normalize(p.numero_conversao).includes(q));
  }
  if (filtros.barcode?.trim()) {
    const q = normalize(filtros.barcode);
    list = list.filter((p) => normalize(p.barras).includes(q));
  }

  return list.length;
}

function formatDatePtBr(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-br');
}

function normalize(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function formatMultiSelectLabel(selected, allLabel) {
  if (selected.length === 0) return allLabel;
  if (selected.length <= 2) return selected.join(', ');
  return `${selected[0]}, ${selected[1]} +${selected.length - 2}`;
}

function MultiSelectFilter({
  label,
  allLabel,
  options,
  selected,
  onChange,
  optionLevels = null,
  optionStates = null,
  onToggleOption = null,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function toggleOption(option) {
    if (onToggleOption) {
      onToggleOption(option);
      return;
    }

    onChange(
      selected.includes(option)
        ? selected.filter((v) => v !== option)
        : [...selected, option]
    );
  }

  return (
    <div className="catalogo2-multiselect" ref={wrapRef}>
      <label className="catalogo2-filter-label">{label}</label>

      <button
        type="button"
        className="catalogo2-filter-select catalogo2-multiselect-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="catalogo2-multiselect-value">{formatMultiSelectLabel(selected, allLabel)}</span>
        <span className="catalogo2-filter-chevron">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="catalogo2-multiselect-popover">
          <div className="catalogo2-multiselect-options">
            {options.map((option) => (
              <label className="catalogo2-multiselect-option" key={option}>
                <input
                  type="checkbox"
                  checked={
                    optionStates?.[option]?.checked ??
                    selected.includes(option)
                  }
                  ref={(node) => {
                    if (node) {
                      node.indeterminate =
                        optionStates?.[option]?.indeterminate ?? false;
                    }
                  }}
                  onChange={() => toggleOption(option)}
                />
                <span>
                  {optionLevels?.[option] > 0
                    ? `${' '.repeat(optionLevels[option])}↳ ${option}`
                    : option}
                </span>
              </label>
            ))}
          </div>

          <button
            type="button"
            className="catalogo2-multiselect-clear"
            onClick={() => onChange([])}
            disabled={selected.length === 0}
          >
            Limpar
          </button>
        </div>
      )}
    </div>
  );
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

export function Catalogo2() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const categoryFromUrl =
    searchParams.get('categoria')?.trim() || '';
  const { session, profile, signOut } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [produtos, setProdutos] = useState([]);
  const [catalogCategories, setCatalogCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('codigo');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedLines, setSelectedLines] = useState([]);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [applicationSearch, setApplicationSearch] = useState('');
  const [codeOriSearch, setCodeOriSearch] = useState('');
  const [conversionSearch, setConversionSearch] = useState('');
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [detailProduct, setDetailProduct] = useState(null);
  const [activePhoto, setActivePhoto] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(80);
  const loadMoreRef = useRef(null);

  // Seleções salvas (catalogo_selecoes)
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveModalName, setSaveModalName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showMySelections, setShowMySelections] = useState(false);
  const [mySelections, setMySelections] = useState([]);
  const [loadingSelections, setLoadingSelections] = useState(false);
  const [openSelectionId, setOpenSelectionId] = useState(null);
  const [openSelectionName, setOpenSelectionName] = useState('');
  const [openSelectionSnapshot, setOpenSelectionSnapshot] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [toast, setToast] = useState('');

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  const currentFiltros = useMemo(
    () => buildFiltrosSnapshot({ selectedCategories, selectedLines, selectedBrands, applicationSearch, codeOriSearch, conversionSearch, barcodeSearch, sortBy }),
    [selectedCategories, selectedLines, selectedBrands, applicationSearch, codeOriSearch, conversionSearch, barcodeSearch, sortBy]
  );

  const isSelectionDirty = openSelectionId !== null && !sameFiltros(currentFiltros, openSelectionSnapshot);

  function applyFiltros(filtros) {
    setSelectedCategories(filtros.categories ?? []);
    setSelectedLines(filtros.lines ?? []);
    setSelectedBrands(filtros.brands ?? []);
    setApplicationSearch(filtros.application ?? '');
    setCodeOriSearch(filtros.code ?? '');
    setConversionSearch(filtros.conversion ?? '');
    setBarcodeSearch(filtros.barcode ?? '');
    setSortBy(filtros.sortBy ?? 'codigo');
  }

  // Retomada pós-login: só consome o snapshot pendente aqui em /catalogo, e só quando já
  // existe sessão autenticada válida — nunca antes disso.
  useEffect(() => {
    if (!session) return;
    let pending;
    try { pending = JSON.parse(localStorage.getItem(PENDING_SELECTION_KEY) || 'null'); } catch { pending = null; }
    if (!pending) return;

    localStorage.removeItem(PENDING_SELECTION_KEY);
    applyFiltros(pending.filtros);
    if (pending.intent === 'save') setShowSaveModal(true);
    if (pending.intent === 'mySelections') setShowMySelections(true);
    if (pending.intent === 'generateCatalog') {
      window.open('/catalogo/pdf', '_blank', 'noopener,noreferrer');
    }
  }, [session]);

  function requireLoginThen(intent) {
    localStorage.setItem(PENDING_SELECTION_KEY, JSON.stringify({ intent, filtros: currentFiltros }));
    navigate('/login', { state: { from: '/catalogo' } });
  }

  function handleClickSaveSelecao() {
    if (!session) { requireLoginThen('save'); return; }
    setSaveModalName('');
    setShowSaveModal(true);
  }

  function handleClickMinhasSelecoes() {
    if (!session) { requireLoginThen('mySelections'); return; }
    setShowMySelections(true);
  }

  function handleGenerateCatalog() {
    const catalogIds = filteredList.map((produto) => produto.id);

    localStorage.setItem(
      'ori_catalogo_ids',
      JSON.stringify(catalogIds)
    );

    if (!session) {
      requireLoginThen('generateCatalog');
      return;
    }

    window.open('/catalogo/pdf', '_blank', 'noopener,noreferrer');
  }

  async function handleLogout() {
    setUserMenuOpen(false);
    await signOut();
  }

  useEffect(() => {
    if (!showMySelections || !session) return;
    setLoadingSelections(true);
    supabase
      .from('catalogo_selecoes')
      .select('*')
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error(error);
        setMySelections(data ?? []);
        setLoadingSelections(false);
      });
  }, [showMySelections, session]);

  async function handleConfirmSaveModal(e) {
    e.preventDefault();
    const nome = saveModalName.trim();
    if (!nome || !session) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('catalogo_selecoes')
      .insert({ user_id: session.user.id, nome, filtros: currentFiltros, updated_at: new Date().toISOString() })
      .select()
      .single();
    setSaving(false);
    if (error) { showToast(`Erro ao salvar: ${error.message}`); return; }
    setShowSaveModal(false);
    setOpenSelectionId(data.id);
    setOpenSelectionName(data.nome);
    setOpenSelectionSnapshot(data.filtros);
    showToast('Seleção salva.');
  }

  async function handleSaveChanges() {
    if (!openSelectionId) return;
    const { error } = await supabase
      .from('catalogo_selecoes')
      .update({ filtros: currentFiltros, updated_at: new Date().toISOString() })
      .eq('id', openSelectionId);
    if (error) { showToast(`Erro ao salvar alterações: ${error.message}`); return; }
    setOpenSelectionSnapshot(currentFiltros);
    showToast('Alterações salvas.');
  }

  function handleAbrirSelecao(sel) {
    applyFiltros(sel.filtros);
    setOpenSelectionId(sel.id);
    setOpenSelectionName(sel.nome);
    setOpenSelectionSnapshot(sel.filtros);
    setShowMySelections(false);
  }

  async function handleExcluirSelecao(sel) {
    if (!window.confirm(`Excluir a seleção "${sel.nome}"? Essa ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from('catalogo_selecoes').delete().eq('id', sel.id);
    if (error) { showToast(`Erro ao excluir: ${error.message}`); return; }
    setMySelections((list) => list.filter((s) => s.id !== sel.id));
    if (openSelectionId === sel.id) {
      setOpenSelectionId(null);
      setOpenSelectionName('');
      setOpenSelectionSnapshot(null);
    }
    showToast('Seleção excluída.');
  }

  function handleStartRename(sel) {
    setRenamingId(sel.id);
    setRenameValue(sel.nome);
  }

  async function handleConfirmRename(sel) {
    const novoNome = renameValue.trim();
    if (!novoNome) return;
    const { error } = await supabase
      .from('catalogo_selecoes')
      .update({ nome: novoNome, updated_at: new Date().toISOString() })
      .eq('id', sel.id);
    if (error) { showToast(`Erro ao renomear: ${error.message}`); return; }
    setMySelections((list) => list.map((s) => (s.id === sel.id ? { ...s, nome: novoNome } : s)));
    if (openSelectionId === sel.id) setOpenSelectionName(novoNome);
    setRenamingId(null);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .eq('ativo', true)
        .limit(4000);

      if (cancelled) return;

      if (error) {
        console.error('Erro ao carregar produtos:', error);
        setProdutos([]);
      } else {
        setProdutos(data ?? []);
      }

      setLoading(false);
    }

    async function loadCategories() {
      const { data, error } = await supabase
        .from('catalogo_categorias')
        .select('id, nome, parent_id, ordem, ativo')
        .eq('ativo', true)
        .order('ordem', { ascending: true })
        .order('nome', { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error('Erro ao carregar categorias:', error);
        return;
      }

      setCatalogCategories(data ?? []);
    }

    loadProducts();
    loadCategories();

    function refreshCategories() {
      loadCategories();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        refreshCategories();
      }
    }

    window.addEventListener('focus', refreshCategories);
    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    );

    const categoriesChannel = supabase
      .channel('catalogo-categorias-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'catalogo_categorias',
        },
        () => {
          loadCategories();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;

      window.removeEventListener('focus', refreshCategories);
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      );

      supabase.removeChannel(categoriesChannel);
    };
  }, []);

  useEffect(() => {
    setVisibleCount(80);
  }, [
    search,
    sortBy,
    selectedCategories,
    selectedLines,
    selectedBrands,
    applicationSearch,
    codeOriSearch,
    conversionSearch,
    barcodeSearch,
  ]);

  const categoryTree = useMemo(() => {
    const ordered = [];

    function addWithChildren(category, level = 0) {
      ordered.push({
        ...category,
        level,
      });

      const children = catalogCategories
        .filter((item) => item.parent_id === category.id)
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

      for (const child of children) {
        addWithChildren(child, level + 1);
      }
    }

    const roots = catalogCategories
      .filter((category) => !category.parent_id)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    for (const root of roots) {
      addWithChildren(root);
    }

    return ordered;
  }, [catalogCategories]);


  function getCategoryBranchNames(categoryName) {
    const category = catalogCategories.find(
      (item) => item.nome === categoryName
    );

    if (!category) {
      return [categoryName];
    }

    const names = [];

    function addCategoryAndChildren(currentCategory) {
      names.push(currentCategory.nome);

      const children = catalogCategories.filter(
        (item) => item.parent_id === currentCategory.id
      );

      for (const child of children) {
        addCategoryAndChildren(child);
      }
    }

    addCategoryAndChildren(category);

    return names;
  }

  useEffect(() => {
    if (!categoryFromUrl || !catalogCategories.length) {
      return;
    }

    const branchNames = getCategoryBranchNames(categoryFromUrl);

    setSelectedCategories(branchNames);
  }, [categoryFromUrl, catalogCategories]);

  function handleCategoryToggle(categoryName) {
    const branchNames = getCategoryBranchNames(categoryName);

    setSelectedCategories((current) => {
      const next = new Set(current);

      const allSelected = branchNames.every(
        (name) => next.has(name)
      );

      if (allSelected) {
        branchNames.forEach((name) => next.delete(name));
      } else {
        branchNames.forEach((name) => next.add(name));
      }

      return Array.from(next);
    });
  }

  const categoryOptionStates = useMemo(() => {
    const states = {};

    function getBranchNames(category) {
      const names = [category.nome];

      const children = catalogCategories.filter(
        (item) => item.parent_id === category.id
      );

      for (const child of children) {
        names.push(...getBranchNames(child));
      }

      return names;
    }

    for (const category of categoryTree) {
      const branchNames = getBranchNames(category);

      const selectedCount = branchNames.filter(
        (name) => selectedCategories.includes(name)
      ).length;

      states[category.nome] = {
        checked:
          branchNames.length > 0 &&
          selectedCount === branchNames.length,

        indeterminate:
          selectedCount > 0 &&
          selectedCount < branchNames.length,
      };
    }

    return states;
  }, [
    categoryTree,
    catalogCategories,
    selectedCategories,
  ]);


  const selectedCategoryNames = useMemo(() => {
    if (!selectedCategories.length) {
      return null;
    }

    return new Set(selectedCategories);
  }, [selectedCategories]);

  const filteredList = useMemo(() => {
    let list = produtos.filter((p) => matchesSearch(p, search));

    if (selectedCategories.length) {
      list = list.filter((p) =>
        selectedCategoryNames?.has(p.categoria)
      );
    }

    if (selectedBrands.length) {
        list = list.filter((p) => selectedBrands.includes(p.marca));
    }

    if (selectedLines.length) {
        list = list.filter((p) => {
        const linhasProduto = (p.linha || '')
            .split(',')
            .map((linha) => linha.trim())
            .filter(Boolean);

        return linhasProduto.some((linha) => selectedLines.includes(linha));
        });
    }

    if (applicationSearch.trim()) {
      const q = normalize(applicationSearch);

      list = list.filter((p) => {
        const applications = Array.isArray(p.aplicacoes) ? p.aplicacoes : [];

        return applications.some((app) =>
          [
            app.veiculo,
            app.geracao,
            app.portas,
            app.ano_apos,
            app.ate,
            app.obs,
          ].some((value) => normalize(value).includes(q))
        );
      });
    }

    if (codeOriSearch.trim()) {
      const q = normalize(codeOriSearch);

      list = list.filter((p) =>
        normalize(p.codigo).includes(q)
      );
    }

    if (conversionSearch.trim()) {
      const q = normalize(conversionSearch);

      list = list.filter((p) =>
        normalize(p.numero_conversao).includes(q)
      );
    }

    if (barcodeSearch.trim()) {
      const q = normalize(barcodeSearch);

      list = list.filter((p) =>
        normalize(p.barras).includes(q)
      );
    }

    return list.slice().sort((a, b) => {
        const codigoA = parseInt(a.codigo, 10) || 0;
        const codigoB = parseInt(b.codigo, 10) || 0;

        if (sortBy === 'codigo') {
        return codigoA - codigoB;
        }

        if (sortBy === 'marca') {
        return (
            (a.marca || '').localeCompare(b.marca || '', 'pt-BR') ||
            codigoA - codigoB
        );
        }

        if (sortBy === 'linha') {
        return (
            (a.linha || '').localeCompare(b.linha || '', 'pt-BR') ||
            codigoA - codigoB
        );
        }

        if (sortBy === 'categoria') {
        return (
            (a.categoria || '').localeCompare(b.categoria || '', 'pt-BR') ||
            codigoA - codigoB
        );
        }

        if (sortBy === 'descricao') {
        return (
            (a.descricao || '').localeCompare(b.descricao || '', 'pt-BR') ||
            codigoA - codigoB
        );
        }

        if (sortBy === 'conversao') {
        const convA = (a.numero_conversao || '').trim();
        const convB = (b.numero_conversao || '').trim();

        if (!convA && !convB) return codigoA - codigoB;
        if (!convA) return 1;
        if (!convB) return -1;

        return (
            convA.localeCompare(convB, 'pt-BR', {
            numeric: true,
            sensitivity: 'base',
            }) || codigoA - codigoB
        );
        }

        if (sortBy === 'barras') {
        const barrasA = (a.barras || '').trim();
        const barrasB = (b.barras || '').trim();

        if (!barrasA && !barrasB) return codigoA - codigoB;
        if (!barrasA) return 1;
        if (!barrasB) return -1;

        return (
            barrasA.localeCompare(barrasB, 'pt-BR', {
            numeric: true,
            sensitivity: 'base',
            }) || codigoA - codigoB
        );
        }

        return codigoA - codigoB;
    });
    }, [
    produtos,
    search,
    sortBy,
    selectedCategories,
    selectedCategoryNames,
    selectedLines,
    selectedBrands,
    applicationSearch,
    codeOriSearch,
    conversionSearch,
    barcodeSearch,
    ]);

    const visibleProducts = filteredList.slice(0, visibleCount);

    useEffect(() => {
      const target = loadMoreRef.current;

      if (!target || visibleCount >= filteredList.length) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;

          setVisibleCount((current) =>
            Math.min(current + 80, filteredList.length)
          );
        },
        {
          root: null,
          rootMargin: '400px 0px',
          threshold: 0,
        }
      );

      observer.observe(target);

      return () => observer.disconnect();
    }, [visibleCount, filteredList.length]);

    const filterOptions = useMemo(() => {
      const categories = new Set();
      const brands = new Set();
      const lines = new Set();

      produtos.forEach((p) => {
        if (p.categoria) {
          categories.add(p.categoria);
        }

        if (p.marca) {
          brands.add(p.marca);
    }

    if (p.linha) {
      p.linha
        .split(',')
        .map((linha) => linha.trim())
        .filter(Boolean)
        .forEach((linha) => lines.add(linha));
    }
  });

  return {
    categories: categoryTree.map((category) => category.nome),

    brands: [...brands].sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    ),

    lines: [...lines].sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    ),
  };
}, [produtos, categoryTree]);

  return (
    <div className="catalogo2-page">
      
      <header className="catalogo2-header">
        <div className="catalogo2-header-left">
          <button
            type="button"
            className="catalogo2-logo"
            onClick={() => navigate('/')}
            aria-label="Voltar ao início"
          >
            <img src="/assets/logo.png" alt="Ori" />
          </button>

          <button
            type="button"
            className="catalogo2-home-link"
            onClick={() => navigate('/')}
          >
            Início
          </button>
        </div>

        <div className="catalogo2-search">
          <span className="catalogo2-search-icon">⌕</span>

          <input
            type="text"
            placeholder="Buscar por código, referência, descrição, veículo ou marca"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="catalogo2-header-actions">
          <span className="catalogo2-updated">
            <span className="catalogo2-updated-dot" />
            Catálogo atualizado
          </span>

          <button
            type="button"
            className="catalogo2-export-btn"
            onClick={handleGenerateCatalog}
          >
            Gerar catálogo
          </button>

          {!session ? (
            <button
              type="button"
              className="catalogo2-login-btn"
              onClick={() => navigate('/login', { state: { from: '/catalogo' } })}
            >
              Entrar
            </button>
          ) : (
            <div className="catalogo2-user">
              <button
                type="button"
                className="catalogo2-user-btn"
                onClick={() => setUserMenuOpen((value) => !value)}
                aria-expanded={userMenuOpen}
              >
                <span className="catalogo2-user-avatar">
                  {(profile?.nome || session.user.email || 'U')
                    .charAt(0)
                    .toUpperCase()}
                </span>

                <span className="catalogo2-user-name">
                  {profile?.nome ||
                    session.user.user_metadata?.full_name ||
                    session.user.email?.split('@')[0] ||
                    'Usuário'}
                </span>

                <svg
                  className="catalogo2-user-chevron"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    d="M5.5 7.5 10 12l4.5-4.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {userMenuOpen && (
                <div className="catalogo2-user-menu">
                  <div className="catalogo2-user-menu-head">
                    <strong>
                      {profile?.nome ||
                        session.user.user_metadata?.full_name ||
                        session.user.email?.split('@')[0] ||
                        'Usuário'}
                    </strong>

                    <span>{session.user.email}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate('/conta');
                    }}
                  >
                    Minha conta
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      handleClickMinhasSelecoes();
                    }}
                  >
                    Minhas seleções
                  </button>

                  <button
                    type="button"
                    className="catalogo2-user-menu-logout"
                    onClick={handleLogout}
                  >
                    Sair
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="catalogo2-layout">
        <aside className={`catalogo2-sidebar ${mobileFiltersOpen ? 'is-mobile-open' : ''}`}>
            <button
                type="button"
                className="catalogo2-mobile-filter-close"
                onClick={() => setMobileFiltersOpen(false)}
                aria-label="Fechar filtros"
                >
                ×
            </button>
            <div className="catalogo2-sidebar-eyebrow">
                REFINAR RESULTADOS
            </div>

            <div className="catalogo2-sidebar-head">
                <h2>Filtros</h2>

              <button
                type="button"
                className="catalogo2-clear-all"
                onClick={() => {
                  setSearch('');
                  setSelectedCategories([]);
                  setSelectedLines([]);
                  setSelectedBrands([]);
                  setApplicationSearch('');
                  setCodeOriSearch('');
                  setConversionSearch('');
                  setBarcodeSearch('');
                }}
              >
                Limpar
              </button>  
            </div>

            <div className="catalogo2-filter-section">
                <MultiSelectFilter
                  label="Categoria"
                  allLabel="Todas as categorias"
                  options={filterOptions.categories}
                  selected={selectedCategories}
                  onChange={setSelectedCategories}
                  optionLevels={Object.fromEntries(
                    categoryTree.map((category) => [
                      category.nome,
                      category.level,
                    ])
                  )}
                  optionStates={categoryOptionStates}
                  onToggleOption={handleCategoryToggle}
                />
            </div>

            <div className="catalogo2-filter-divider" />

            <div className="catalogo2-filter-section">
              <MultiSelectFilter
                label="Linha"
                allLabel="Todas as linhas"
                options={filterOptions.lines}
                selected={selectedLines}
                onChange={setSelectedLines}
              />
            </div>

            <div className="catalogo2-filter-section">
              <MultiSelectFilter
                label="Marca"
                allLabel="Todas as marcas"
                options={filterOptions.brands}
                selected={selectedBrands}
                onChange={setSelectedBrands}
              />
            </div>

            <div className="catalogo2-filter-divider" />

            <div className="catalogo2-filter-section">
              <label className="catalogo2-filter-label">Aplicação</label>

              <input
                type="text"
                className="catalogo2-filter-input"
                placeholder="Veículo ou aplicação"
                value={applicationSearch}
                onChange={(e) => setApplicationSearch(e.target.value)}
              />
            </div>

            <div className="catalogo2-filter-divider" />

            <div className="catalogo2-filter-section">
              <label className="catalogo2-filter-label">Códigos</label>

              <input
                type="text"
                className="catalogo2-filter-input"
                placeholder="Código Ori"
                value={codeOriSearch}
                onChange={(e) => setCodeOriSearch(e.target.value)}
              />

              <input
                type="text"
                className="catalogo2-filter-input"
                placeholder="Código de conversão"
                value={conversionSearch}
                onChange={(e) => setConversionSearch(e.target.value)}
              />

              <input
                type="text"
                className="catalogo2-filter-input"
                placeholder="Código de barras"
                value={barcodeSearch}
                onChange={(e) => setBarcodeSearch(e.target.value)}
              />
            </div>

            <div className="catalogo2-filter-divider" />

            <div className="catalogo2-filter-section catalogo2-selecao-section">
              {openSelectionId && (
                <div className="catalogo2-selecao-aberta">
                  Seleção aberta: <strong>{openSelectionName}</strong>
                </div>
              )}

              {isSelectionDirty && (
                <button type="button" className="catalogo2-btn-primary" onClick={handleSaveChanges}>
                  Salvar alterações
                </button>
              )}

              <button type="button" className="catalogo2-btn-primary" onClick={handleClickSaveSelecao}>
                Salvar seleção
              </button>

              <button type="button" className="catalogo2-btn-link" onClick={handleClickMinhasSelecoes}>
                Minhas seleções
              </button>

              <button
                type="button"
                className="catalogo2-btn-secondary"
                onClick={handleGenerateCatalog}
              >
                Gerar catálogo
              </button>
            </div>
            </aside>
            {mobileFiltersOpen && (
                <div
                    className="catalogo2-mobile-filter-backdrop"
                    onClick={() => setMobileFiltersOpen(false)}
                />
            )}

        <section className="catalogo2-content">
          <div className="catalogo2-results-header">
            <strong>
              {loading
                ? 'Carregando...'
                : `${filteredList.length} produtos encontrados`}
            </strong>
                <button
                    type="button"
                    className="catalogo2-mobile-filter-btn"
                    onClick={() => setMobileFiltersOpen(true)}
                    >
                Filtros
                </button>
            <div className="catalogo2-sort">
            <span>Ordenar por:</span>

            <select value={sortBy}onChange={(e) => {setSortBy(e.target.value); window.scrollTo({top: 0, behavior: 'smooth', });}}>
                <option value="codigo">Código Ori</option>
                <option value="marca">Marca</option>
                <option value="linha">Linha</option>
                <option value="categoria">Categoria</option>
                <option value="conversao">Código de Conversão</option>
                <option value="barras">Código de Barras</option>
                <option value="descricao">Descrição</option>
            </select>
            </div>
          </div>

          <div className="catalogo2-grid">
            {!loading &&
              visibleProducts.map((p) => (
                <article
                    className="catalogo2-card"
                    key={p.id}
                    onClick={() => {
                        setDetailProduct(p);
                        setActivePhoto(
                        p.galeria?.[0]?.gde ||
                        p.foto_local_gde ||
                        p.foto_local ||
                        null
                        );
                        setLightboxOpen(false);
                    }}
                    >
                    <div className="catalogo2-card-image">
                        {p.foto_local ? (
                        <img
                            src={p.foto_local}
                            alt={p.descricao || ''}
                            loading="lazy"
                        />
                        ) : (
                        <div className="catalogo2-image-missing">
                            Imagem indisponível
                        </div>
                        )}
                    </div>

                    <div className="catalogo2-card-body">
                        <div className="catalogo2-card-brand">
                        {p.marca || '—'}
                        </div>

                        <p className="catalogo2-card-description">
                        {p.descricao}
                        </p>

                        <div className="catalogo2-card-code">
                        Cód. {p.codigo}
                        {p.numero_conversao ? ` — Conv. ${p.numero_conversao}` : ''}
                        </div>
                    </div>
                </article>
              ))}
          </div>
          <div ref={loadMoreRef} className="catalogo2-load-more-sentinel" />
        </section>
      </main>
      {detailProduct && (
  <div
    className="catalogo2-detail-overlay"
    onClick={(e) => {
      if (e.target === e.currentTarget) {
        setDetailProduct(null);
      }
    }}
  >
    <div className="catalogo2-detail-modal">
      <button
        type="button"
        className="catalogo2-detail-close"
        onClick={() => setDetailProduct(null)}
        aria-label="Fechar"
      >
        ×
      </button>

      <div className="catalogo2-detail-top">
        <div className="catalogo2-detail-media">
          <div
            className={`catalogo2-detail-main-image ${
              activePhoto ? 'is-clickable' : ''
            }`}
            onClick={() => {
              if (activePhoto) setLightboxOpen(true);
            }}
          >
            {activePhoto ? (
              <img
                src={activePhoto}
                alt={detailProduct.descricao || ''}
              />
            ) : (
              <div className="catalogo2-detail-image-missing">
                Imagem indisponível
              </div>
            )}
          </div>

          {detailProduct.galeria?.length > 1 && (
            <div className="catalogo2-detail-thumbs">
              {detailProduct.galeria.map((g, index) => (
                <button
                  type="button"
                  key={index}
                  className={`catalogo2-detail-thumb ${
                    activePhoto === g.gde ? 'active' : ''
                  }`}
                  onClick={() => setActivePhoto(g.gde)}
                >
                  <img src={g.peq || g.gde} alt="" />
                </button>
              ))}
            </div>
          )}

          {activePhoto && (
            <div className="catalogo2-detail-zoom-hint">
              Clique na imagem para ampliar
            </div>
          )}
        </div>

        <div className="catalogo2-detail-info">
          <div className="catalogo2-detail-brand">
            {detailProduct.marca || '—'}
          </div>

          <h2>{detailProduct.descricao}</h2>

          <div className="catalogo2-detail-primary-codes">
            <div>
              <span>Código Ori</span>
              <strong>{detailProduct.codigo || '—'}</strong>
            </div>

            <div>
              <span>Conversão</span>
              <strong>{detailProduct.numero_conversao || '—'}</strong>
            </div>
          </div>

          <div className="catalogo2-detail-specs">
            <div className="catalogo2-detail-spec-row">
              <span>Código Original</span>
              <strong>{detailProduct.original || '—'}</strong>
            </div>

            <div className="catalogo2-detail-spec-row">
              <span>Categoria</span>
              <strong>{detailProduct.categoria || '—'}</strong>
            </div>

            <div className="catalogo2-detail-spec-row">
              <span>Linha</span>
              <strong>{detailProduct.linha || '—'}</strong>
            </div>

            <div className="catalogo2-detail-spec-row">
              <span>Peso líquido Kg</span>
              <strong>{detailProduct.peso_liquido || '—'}</strong>
            </div>

            <div className="catalogo2-detail-spec-row">
              <span>Código de barras</span>
              <strong>{detailProduct.barras || '—'}</strong>
            </div>
          </div>
        </div>
      </div>

      {detailProduct.aplicacoes?.length > 0 && (
        <div className="catalogo2-detail-applications">
          <div className="catalogo2-detail-section-head">
            <h3>Aplicação veicular</h3>

            <span>
              {detailProduct.aplicacoes.length}{' '}
              {detailProduct.aplicacoes.length === 1
                ? 'veículo'
                : 'veículos'}
            </span>
          </div>

          <div className="catalogo2-application-grid">
            {detailProduct.aplicacoes.map((a, index) => (
              <div className="catalogo2-application-card" key={index}>
                <div className="catalogo2-application-title">
                  <strong>{a.veiculo || '—'}</strong>

                  {a.geracao && <span>{a.geracao}</span>}
                </div>

                <div className="catalogo2-application-meta">
                  {a.portas && <span>{a.portas} portas</span>}

                  {(a.ano_apos || a.ate) && (
                    <span>
                      {a.ano_apos || '—'}
                      {a.ate ? ` a ${a.ate}` : ' em diante'}
                    </span>
                  )}
                </div>

                {a.obs && (
                  <div className="catalogo2-application-obs">
                    {a.obs}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
)}

{lightboxOpen && activePhoto && (
  <div
    className="catalogo2-lightbox"
    onClick={() => setLightboxOpen(false)}
  >
    <button
      type="button"
      className="catalogo2-lightbox-close"
      onClick={() => setLightboxOpen(false)}
      aria-label="Fechar imagem"
    >
      ×
    </button>

    <img
      src={activePhoto}
      alt={detailProduct?.descricao || ''}
      onClick={(e) => e.stopPropagation()}
    />
  </div>
)}

{showSaveModal && (
  <div className="catalogo2-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowSaveModal(false)}>
    <div className="catalogo2-modal">
      <h2>Salvar seleção</h2>
      <form onSubmit={handleConfirmSaveModal}>
        <label className="catalogo2-filter-label">Nome da seleção</label>
        <input
          type="text"
          className="catalogo2-filter-input"
          placeholder="Ex.: Arim Componentes"
          value={saveModalName}
          onChange={(e) => setSaveModalName(e.target.value)}
          autoFocus
          required
        />
        <div className="catalogo2-modal-actions">
          <button type="button" className="catalogo2-btn-secondary" onClick={() => setShowSaveModal(false)}>Cancelar</button>
          <button type="submit" className="catalogo2-btn-primary" disabled={saving || !saveModalName.trim()}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

{showMySelections && (
  <div className="catalogo2-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowMySelections(false)}>
    <div className="catalogo2-modal catalogo2-modal-wide">
      <h2>Minhas seleções</h2>

      {loadingSelections ? (
        <p className="catalogo2-selecoes-empty">Carregando...</p>
      ) : mySelections.length === 0 ? (
        <p className="catalogo2-selecoes-empty">Nenhuma seleção salva ainda.</p>
      ) : (
        <div className="catalogo2-selecoes-list">
          {mySelections.map((sel) => (
            <div className="catalogo2-selecao-item" key={sel.id}>
              <div className="catalogo2-selecao-info">
                {renamingId === sel.id ? (
                  <input
                    type="text"
                    className="catalogo2-filter-input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    autoFocus
                  />
                ) : (
                  <strong>{sel.nome}</strong>
                )}
                <span>{countMatchingProducts(produtos, sel.filtros)} produtos atualmente</span>
                <span className="catalogo2-selecao-updated">Atualizado em {formatDatePtBr(sel.updated_at)}</span>
              </div>

              <div className="catalogo2-selecao-actions">
                {renamingId === sel.id ? (
                  <>
                    <button type="button" className="catalogo2-btn-link" onClick={() => handleConfirmRename(sel)}>Confirmar</button>
                    <button type="button" className="catalogo2-btn-link" onClick={() => setRenamingId(null)}>Cancelar</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="catalogo2-btn-link" onClick={() => handleAbrirSelecao(sel)}>Abrir</button>
                    <button type="button" className="catalogo2-btn-link" onClick={() => handleStartRename(sel)}>Renomear</button>
                    <button type="button" className="catalogo2-btn-link catalogo2-btn-danger" onClick={() => handleExcluirSelecao(sel)}>Excluir</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="catalogo2-modal-actions">
        <button type="button" className="catalogo2-btn-secondary" onClick={() => setShowMySelections(false)}>Fechar</button>
      </div>
    </div>
  </div>
)}

{toast && <div className="catalogo2-toast">{toast}</div>}
    </div>
  );
}