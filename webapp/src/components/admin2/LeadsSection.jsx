import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';

import './LeadsSection.css';

export function LeadsSection() {
  const [leads, setLeads] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [originFilter, setOriginFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLeads() {
      setLoading(true);
      setError('');

      const [leadsResult, profilesResult] = await Promise.all([
        supabase
          .from('leads')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1000),

        supabase
          .from('profiles')
          .select('id, nome, email, empresa, role'),
      ]);

      if (cancelled) return;

      if (leadsResult.error) {
        console.error('Erro ao carregar leads:', leadsResult.error);
        setLeads([]);
        setError('Não foi possível carregar os leads.');
      } else {
        setLeads(leadsResult.data ?? []);
      }

      if (profilesResult.error) {
        console.error(
          'Erro ao carregar perfis dos representantes:',
          profilesResult.error
        );
        setProfiles([]);
      } else {
        setProfiles(profilesResult.data ?? []);
      }

      setLoading(false);
    }

    loadLeads();

    return () => {
      cancelled = true;
    };
  }, []);

  const profilesById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles]
  );

  const origins = useMemo(() => {
    return [...new Set(leads.map((lead) => lead.origem).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, 'pt-BR')
    );
  }, [leads]);

  const regions = useMemo(() => {
    return [...new Set(leads.map((lead) => lead.regiao).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, 'pt-BR')
    );
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');

    return leads.filter((lead) => {
      if (originFilter && lead.origem !== originFilter) {
        return false;
      }

      if (regionFilter && lead.regiao !== regionFilter) {
        return false;
      }

      if (query) {
        const searchable = [
          lead.nome,
          lead.email,
          lead.telefone,
          lead.empresa,
          lead.regiao,
          lead.origem,
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('pt-BR');

        if (!searchable.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [leads, search, originFilter, regionFilter]);

  function formatDate(value) {
    if (!value) return '—';

    return new Date(value).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }

  function formatOrigin(value) {
    if (!value) return '—';

    if (value === 'catalogo_pdf') {
      return 'Catálogo PDF';
    }

    return value
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function clearFilters() {
    setSearch('');
    setOriginFilter('');
    setRegionFilter('');
  }

  return (
    <section className="admin2-leads">
      <div className="admin2-leads-toolbar">
        <div>
          <h2>Leads</h2>

          <p>
            {loading
              ? 'Carregando leads...'
              : `${filteredLeads.length.toLocaleString('pt-BR')} lead${
                  filteredLeads.length === 1 ? '' : 's'
                } encontrado${filteredLeads.length === 1 ? '' : 's'}`}
          </p>
        </div>

        <div className="admin2-leads-total">
          <strong>{leads.length.toLocaleString('pt-BR')}</strong>
          <span>capturados</span>
        </div>
      </div>

      <div className="admin2-leads-filters">
        <input
          type="search"
          placeholder="Buscar nome, e-mail, empresa, telefone..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select
          value={originFilter}
          onChange={(event) => setOriginFilter(event.target.value)}
        >
          <option value="">Todas as origens</option>

          {origins.map((origin) => (
            <option key={origin} value={origin}>
              {formatOrigin(origin)}
            </option>
          ))}
        </select>

        <select
          value={regionFilter}
          onChange={(event) => setRegionFilter(event.target.value)}
        >
          <option value="">Todas as regiões</option>

          {regions.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </select>

        {(search || originFilter || regionFilter) && (
          <button
            type="button"
            className="admin2-leads-clear"
            onClick={clearFilters}
          >
            Limpar filtros
          </button>
        )}
      </div>

      {error && <div className="admin2-form-error">{error}</div>}

      {!loading && !error && filteredLeads.length === 0 && (
        <div className="admin2-empty-state">
          Nenhum lead encontrado com estes critérios.
        </div>
      )}

      <div className="admin2-leads-list">
        {filteredLeads.map((lead) => {
          const products = Array.isArray(lead.produtos_selecionados)
            ? lead.produtos_selecionados
            : [];

          const representative = lead.vendedor_id
            ? profilesById.get(lead.vendedor_id)
            : null;

          const isOpen = openId === lead.id;

          return (
            <article className="admin2-lead-card" key={lead.id}>
              <button
                type="button"
                className="admin2-lead-summary"
                onClick={() =>
                  setOpenId((current) =>
                    current === lead.id ? null : lead.id
                  )
                }
                aria-expanded={isOpen}
              >
                <div className="admin2-lead-person">
                  <strong>{lead.nome || 'Sem nome'}</strong>

                  <span>
                    {lead.empresa || 'Empresa não informada'}
                  </span>
                </div>

                <div className="admin2-lead-contact">
                  <strong>{lead.email || '—'}</strong>
                  <span>{lead.telefone || 'Sem telefone'}</span>
                </div>

                <div className="admin2-lead-origin">
                  <span>{formatOrigin(lead.origem)}</span>
                  <small>{lead.regiao || 'Região não informada'}</small>
                </div>

                <div className="admin2-lead-products-count">
                  <strong>{products.length}</strong>
                  <span>
                    produto{products.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="admin2-lead-date">
                  {formatDate(lead.created_at)}
                </div>

                <div className="admin2-lead-chevron">
                  {isOpen ? '⌃' : '⌄'}
                </div>
              </button>

              {isOpen && (
                <div className="admin2-lead-details">
                  <div className="admin2-lead-details-grid">
                    <div>
                      <span>Nome</span>
                      <strong>{lead.nome || '—'}</strong>
                    </div>

                    <div>
                      <span>Empresa</span>
                      <strong>{lead.empresa || '—'}</strong>
                    </div>

                    <div>
                      <span>E-mail</span>
                      <strong>{lead.email || '—'}</strong>
                    </div>

                    <div>
                      <span>Telefone</span>
                      <strong>{lead.telefone || '—'}</strong>
                    </div>

                    <div>
                      <span>Região</span>
                      <strong>{lead.regiao || '—'}</strong>
                    </div>

                    <div>
                      <span>Origem</span>
                      <strong>{formatOrigin(lead.origem)}</strong>
                    </div>

                    <div>
                      <span>Representante</span>
                      <strong>
                        {representative
                          ? representative.nome ||
                            representative.email ||
                            'Representante'
                          : 'Sem representante vinculado'}
                      </strong>
                    </div>

                    <div>
                      <span>Capturado em</span>
                      <strong>{formatDate(lead.created_at)}</strong>
                    </div>
                  </div>

                  <div className="admin2-lead-products">
                    <div className="admin2-lead-products-title">
                      <strong>Produtos selecionados</strong>
                      <span>{products.length}</span>
                    </div>

                    {products.length === 0 ? (
                      <p>Nenhum produto registrado neste lead.</p>
                    ) : (
                      <div className="admin2-lead-products-list">
                        {products.map((product, index) => (
                          <div
                            className="admin2-lead-product"
                            key={`${
                              product.id ?? product.codigo ?? index
                            }-${index}`}
                          >
                            <strong>
                              {product.codigo || 'Sem código'}
                            </strong>

                            <span>
                              {product.descricao || 'Sem descrição'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}