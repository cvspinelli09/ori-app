import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';

const PERIOD_CONFIG = {
  '30d': { days: 30 },
  '90d': { days: 90 },
  '6m': { months: 6 },
  '12m': { months: 12 },
};

const REGIONS = [
  'Sudeste',
  'Sul',
  'Nordeste',
  'Centro-Oeste',
  'Norte',
];

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

function normalizeRegion(value) {
  const text = String(value || '')
    .trim()
    .toLocaleLowerCase('pt-BR');

  if (!text) return null;

  if (text === 'sudeste') return 'Sudeste';
  if (text === 'sul') return 'Sul';
  if (text === 'nordeste') return 'Nordeste';

  if (
    text === 'centro-oeste' ||
    text === 'centro oeste'
  ) {
    return 'Centro-Oeste';
  }

  if (text === 'norte') return 'Norte';

  return null;
}

export function RegionalDistribution({
  period = '30d',
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const periodStart = useMemo(
    () => getPeriodStart(period),
    [period]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadRegionalDistribution() {
      if (!periodStart) {
        setRows([]);
        setLoading(false);
        setError('');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const now = new Date().toISOString();

        const [
          profilesResult,
          selectionsResult,
          leadsResult,
        ] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, role, regiao')
            .eq('role', 'cliente'),

          supabase
            .from('catalogo_selecoes')
            .select('id, user_id, updated_at')
            .gte('updated_at', periodStart)
            .lte('updated_at', now),

          supabase
            .from('leads')
            .select('id, regiao, created_at')
            .gte('created_at', periodStart)
            .lte('created_at', now),
        ]);

        if (profilesResult.error) {
          throw profilesResult.error;
        }

        if (selectionsResult.error) {
          throw selectionsResult.error;
        }

        if (leadsResult.error) {
          throw leadsResult.error;
        }

        const profileById = new Map(
          (profilesResult.data ?? []).map(
            (profile) => [profile.id, profile]
          )
        );

        const regionData = new Map(
          REGIONS.map((region) => [
            region,
            {
              region,
              activeClientIds: new Set(),
              selections: 0,
              leads: 0,
            },
          ])
        );

        for (const selection of
          selectionsResult.data ?? []) {
          const profile = profileById.get(
            selection.user_id
          );

          if (!profile) continue;

          const region = normalizeRegion(
            profile.regiao
          );

          if (!region) continue;

          const current = regionData.get(region);

          current.selections += 1;
          current.activeClientIds.add(
            selection.user_id
          );
        }

        for (const lead of leadsResult.data ?? []) {
          const region = normalizeRegion(
            lead.regiao
          );

          if (!region) continue;

          regionData.get(region).leads += 1;
        }

        const nextRows = REGIONS.map((region) => {
          const item = regionData.get(region);

          return {
            region,
            activeClients:
              item.activeClientIds.size,
            selections: item.selections,
            leads: item.leads,
          };
        });

        if (!cancelled) {
          setRows(nextRows);
        }
      } catch (err) {
        console.error(
          'Erro ao carregar distribuição regional:',
          err
        );

        if (!cancelled) {
          setRows([]);
          setError(
            'Não foi possível carregar a distribuição por região.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRegionalDistribution();

    return () => {
      cancelled = true;
    };
  }, [periodStart]);

  const maxClients = Math.max(
    ...rows.map((row) => row.activeClients),
    1
  );

  const maxSelections = Math.max(
    ...rows.map((row) => row.selections),
    1
  );

  const maxLeads = Math.max(
    ...rows.map((row) => row.leads),
    1
  );

  return (
    <section className="admin2-overview-block admin2-regional-distribution">
      <div className="admin2-overview-block-heading">
        <div>
          <h2>Distribuição por região</h2>
          <p>
            Onde estão os clientes e a atividade comercial
            no período selecionado.
          </p>
        </div>
      </div>

      {period === 'custom' ? (
        <div className="admin2-regional-empty">
          Defina o período personalizado para visualizar
          os dados.
        </div>
      ) : error ? (
        <div className="admin2-form-error">
          {error}
        </div>
      ) : loading ? (
        <div className="admin2-regional-empty">
          Carregando distribuição regional...
        </div>
      ) : (
        <div className="admin2-regional-table">
          <div className="admin2-regional-row is-header">
            <span>Região</span>
            <span>Clientes ativos</span>
            <span>Seleções</span>
            <span>Leads</span>
          </div>

          {rows.map((row) => (
            <div
              className="admin2-regional-row"
              key={row.region}
            >
              <strong>{row.region}</strong>

              <RegionalMetric
                value={row.activeClients}
                max={maxClients}
              />

              <RegionalMetric
                value={row.selections}
                max={maxSelections}
              />

              <RegionalMetric
                value={row.leads}
                max={maxLeads}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RegionalMetric({ value, max }) {
  const percentage =
    max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="admin2-regional-metric">
      <span>{value.toLocaleString('pt-BR')}</span>

      <div className="admin2-regional-bar">
        <i
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  );
}