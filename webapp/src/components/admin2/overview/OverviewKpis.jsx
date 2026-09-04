import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';

const PERIOD_LABELS = {
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 90 dias',
  '6m': 'Últimos 6 meses',
  '12m': 'Últimos 12 meses',
};

function getPeriodStart(period) {
  const now = new Date();
  const start = new Date(now);

  if (period === '30d') {
    start.setDate(start.getDate() - 30);
  } else if (period === '90d') {
    start.setDate(start.getDate() - 90);
  } else if (period === '6m') {
    start.setMonth(start.getMonth() - 6);
  } else if (period === '12m') {
    start.setMonth(start.getMonth() - 12);
  } else {
    return null;
  }

  return start.toISOString();
}

export function OverviewKpis({ period = '30d' }) {
  const [data, setData] = useState({
    registeredClients: 0,
    activeClients: 0,
    savedSelections: 0,
    generatedLeads: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const periodStart = useMemo(
    () => getPeriodStart(period),
    [period]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadKpis() {
      if (!periodStart) {
        setLoading(false);
        setError('');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const [
          clientsResult,
          selectionsResult,
          leadsResult,
        ] = await Promise.all([
          supabase
            .from('profiles')
            .select('id', { count: 'exact' })
            .eq('role', 'cliente'),

          supabase
            .from('catalogo_selecoes')
            .select('id, user_id')
            .gte('updated_at', periodStart),

          supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', periodStart),
        ]);

        if (clientsResult.error) {
          throw clientsResult.error;
        }

        if (selectionsResult.error) {
          throw selectionsResult.error;
        }

        if (leadsResult.error) {
          throw leadsResult.error;
        }

        const clientIds = new Set(
          (clientsResult.data ?? []).map((client) => client.id)
        );

        const activeClientIds = new Set(
          (selectionsResult.data ?? [])
            .filter((selection) =>
              clientIds.has(selection.user_id)
            )
            .map((selection) => selection.user_id)
        );

        if (cancelled) return;

        setData({
          registeredClients: clientsResult.count ?? 0,
          activeClients: activeClientIds.size,
          savedSelections: selectionsResult.data?.length ?? 0,
          generatedLeads: leadsResult.count ?? 0,
        });
      } catch (err) {
        console.error('Erro ao carregar KPIs da visão geral:', err);

        if (!cancelled) {
          setError(
            'Não foi possível carregar os indicadores da visão geral.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadKpis();

    return () => {
      cancelled = true;
    };
  }, [periodStart]);

  const periodLabel =
    PERIOD_LABELS[period] ?? 'Período personalizado';

  const cards = [
    {
      key: 'registered',
      label: 'Clientes cadastrados',
      value: data.registeredClients,
      caption: 'Total da base',
    },
    {
      key: 'active',
      label: 'Clientes ativos',
      value: data.activeClients,
      caption: periodLabel,
    },
    {
      key: 'selections',
      label: 'Seleções salvas',
      value: data.savedSelections,
      caption: periodLabel,
    },
    {
      key: 'leads',
      label: 'Leads gerados',
      value: data.generatedLeads,
      caption: periodLabel,
    },
  ];

  if (period === 'custom') {
    return (
      <section className="admin2-overview-kpis">
        <div className="admin2-overview-kpis-grid">
          {cards.map((card) => (
            <article
              className="admin2-overview-kpi-card"
              key={card.key}
            >
              <span className="admin2-overview-kpi-label">
                {card.label}
              </span>

              <strong className="admin2-overview-kpi-value">
                —
              </strong>

              <span className="admin2-overview-kpi-caption">
                Defina o período personalizado
              </span>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="admin2-overview-kpis">
      {error && (
        <div className="admin2-form-error">
          {error}
        </div>
      )}

      <div className="admin2-overview-kpis-grid">
        {cards.map((card) => (
          <article
            className="admin2-overview-kpi-card"
            key={card.key}
          >
            <span className="admin2-overview-kpi-label">
              {card.label}
            </span>

            <strong className="admin2-overview-kpi-value">
              {loading
                ? '—'
                : card.value.toLocaleString('pt-BR')}
            </strong>

            <span className="admin2-overview-kpi-caption">
              {card.caption}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}