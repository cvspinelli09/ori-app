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

function getLeadInterest(produtosSelecionados) {
  if (
    !Array.isArray(produtosSelecionados) ||
    produtosSelecionados.length === 0
  ) {
    return 'Sem produtos';
  }

  const first = produtosSelecionados[0];

  let label = '';

  if (typeof first === 'object' && first !== null) {
    label =
      first.codigo ||
      first.code ||
      first.descricao ||
      first.description ||
      'Produto';
  } else {
    label = String(first);
  }

  if (produtosSelecionados.length === 1) {
    return label;
  }

  return `${label} +${produtosSelecionados.length - 1}`;
}

function formatLeadDate(value) {
  if (!value) return '—';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(new Date(value));
}

export function RecentLeads({ period = '30d' }) {
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');

  const periodStart = useMemo(
    () => getPeriodStart(period),
    [period]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadRecentLeads() {
      if (!periodStart) {
        setAllRows([]);
        setLoading(false);
        setError('');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const now = new Date().toISOString();

        const { data, error: leadsError } = await supabase
          .from('leads')
          .select(
            'id, nome, email, telefone, empresa, regiao, produtos_selecionados, created_at'
          )
          .gte('created_at', periodStart)
          .lte('created_at', now)
          .order('created_at', { ascending: false });

        if (leadsError) {
          throw leadsError;
        }

        if (!cancelled) {
          setAllRows(data ?? []);
        }
      } catch (err) {
        console.error(
          'Erro ao carregar leads recentes:',
          err
        );

        if (!cancelled) {
          setAllRows([]);
          setError(
            'Não foi possível carregar os leads recentes.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRecentLeads();

    return () => {
      cancelled = true;
    };
  }, [periodStart]);

  const recentRows = allRows.slice(0, 6);

  const availableRegions = useMemo(() => {
    return [
      ...new Set(
        allRows
          .map((lead) => lead.regiao)
          .filter(Boolean)
      ),
    ].sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    );
  }, [allRows]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLocaleLowerCase('pt-BR');

    return allRows.filter((lead) => {
      const matchesRegion =
        regionFilter === 'all' ||
        lead.regiao === regionFilter;

      if (!matchesRegion) return false;

      if (!normalizedSearch) return true;

      const searchableText = [
        lead.nome,
        lead.email,
        lead.telefone,
        lead.empresa,
        lead.regiao,
        getLeadInterest(
          lead.produtos_selecionados
        ),
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR');

      return searchableText.includes(
        normalizedSearch
      );
    });
  }, [allRows, search, regionFilter]);

  function openDrawer() {
    setSearch('');
    setRegionFilter('all');
    setDrawerOpen(true);
  }

  return (
    <>
      <section className="admin2-overview-block admin2-recent-leads">
        <div className="admin2-overview-block-heading">
          <div>
            <h2>Leads recentes</h2>

            <p>
              Últimas oportunidades geradas no período selecionado.
            </p>
          </div>

          {allRows.length > 0 && (
            <button
              type="button"
              className="admin2-recent-leads-button"
              onClick={openDrawer}
            >
              Ver todos →
            </button>
          )}
        </div>

        {period === 'custom' ? (
          <div className="admin2-recent-leads-empty">
            Defina o período personalizado para visualizar os dados.
          </div>
        ) : error ? (
          <div className="admin2-form-error">
            {error}
          </div>
        ) : loading ? (
          <div className="admin2-recent-leads-empty">
            Carregando leads...
          </div>
        ) : recentRows.length === 0 ? (
          <div className="admin2-recent-leads-empty">
            Nenhum lead gerado neste período.
          </div>
        ) : (
          <div className="admin2-recent-leads-table">
            <div className="admin2-recent-leads-row is-header">
              <span>Contato</span>
              <span>Empresa</span>
              <span>Região</span>
              <span>Interesse</span>
              <span>Data</span>
            </div>

            {recentRows.map((lead) => (
              <div
                className="admin2-recent-leads-row"
                key={lead.id}
              >
                <div className="admin2-recent-leads-contact">
                  <strong title={lead.nome || ''}>
                    {lead.nome || 'Sem nome'}
                  </strong>

                  <span
                    title={
                      lead.email ||
                      lead.telefone ||
                      ''
                    }
                  >
                    {lead.email ||
                      lead.telefone ||
                      '—'}
                  </span>
                </div>

                <span title={lead.empresa || ''}>
                  {lead.empresa || '—'}
                </span>

                <span>
                  {lead.regiao || '—'}
                </span>

                <span
                  title={getLeadInterest(
                    lead.produtos_selecionados
                  )}
                >
                  {getLeadInterest(
                    lead.produtos_selecionados
                  )}
                </span>

                <span>
                  {formatLeadDate(
                    lead.created_at
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {drawerOpen && (
        <div
          className="admin2-leads-drawer-overlay"
          onClick={() => setDrawerOpen(false)}
        >
          <aside
            className="admin2-leads-drawer"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="admin2-leads-drawer-header">
              <div>
                <h2>Leads do período</h2>

                <p>
                  Todas as oportunidades geradas no período selecionado.
                </p>
              </div>

              <button
                type="button"
                className="admin2-leads-drawer-close"
                onClick={() =>
                  setDrawerOpen(false)
                }
                aria-label="Fechar leads"
              >
                ×
              </button>
            </div>

            <div className="admin2-leads-drawer-summary">
              <span>
                <strong>
                  {allRows.length.toLocaleString(
                    'pt-BR'
                  )}
                </strong>{' '}
                leads
              </span>
            </div>

            <div className="admin2-leads-drawer-filters">
              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Buscar nome, empresa, e-mail, telefone ou interesse..."
              />

              <select
                value={regionFilter}
                onChange={(event) =>
                  setRegionFilter(
                    event.target.value
                  )
                }
                aria-label="Filtrar leads por região"
              >
                <option value="all">
                  Todas as regiões
                </option>

                {availableRegions.map(
                  (region) => (
                    <option
                      key={region}
                      value={region}
                    >
                      {region}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="admin2-leads-drawer-result">
              {filteredRows.length.toLocaleString(
                'pt-BR'
              )}{' '}
              {filteredRows.length === 1
                ? 'resultado'
                : 'resultados'}
            </div>

            <div className="admin2-leads-drawer-table">
              <div className="admin2-leads-drawer-row is-header">
                <span>Contato</span>
                <span>Empresa</span>
                <span>Região</span>
                <span>Interesse</span>
                <span>Data</span>
              </div>

              {filteredRows.length === 0 ? (
                <div className="admin2-leads-drawer-empty">
                  Nenhum lead encontrado.
                </div>
              ) : (
                filteredRows.map((lead) => (
                  <div
                    className="admin2-leads-drawer-row"
                    key={lead.id}
                  >
                    <div className="admin2-leads-drawer-contact">
                      <strong
                        title={lead.nome || ''}
                      >
                        {lead.nome ||
                          'Sem nome'}
                      </strong>

                      <span
                        title={
                          lead.email ||
                          lead.telefone ||
                          ''
                        }
                      >
                        {lead.email ||
                          lead.telefone ||
                          '—'}
                      </span>
                    </div>

                    <span
                      title={lead.empresa || ''}
                    >
                      {lead.empresa || '—'}
                    </span>

                    <span>
                      {lead.regiao || '—'}
                    </span>

                    <span
                      title={getLeadInterest(
                        lead.produtos_selecionados
                      )}
                    >
                      {getLeadInterest(
                        lead.produtos_selecionados
                      )}
                    </span>

                    <span>
                      {formatLeadDate(
                        lead.created_at
                      )}
                    </span>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}