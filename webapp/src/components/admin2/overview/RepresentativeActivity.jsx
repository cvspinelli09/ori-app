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

  const now = new Date();
  const start = new Date(now);

  if (config.days) {
    start.setDate(start.getDate() - config.days);
    return start.toISOString();
  }

  if (config.months) {
    start.setMonth(start.getMonth() - config.months);
    return start.toISOString();
  }

  return null;
}

export function RepresentativeActivity({ period = '30d' }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const periodStart = useMemo(
    () => getPeriodStart(period),
    [period]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadRepresentativeActivity() {
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
          representativesResult,
          activityResult,
          leadsResult,
        ] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, nome, email')
            .eq('role', 'vendedor')
            .neq('ativo', false)
            .order('nome'),

          supabase
            .from('vendedor_atividade')
            .select('id, vendedor_id, tipo, created_at')
            .gte('created_at', periodStart)
            .lte('created_at', now),

          supabase
            .from('leads')
            .select('id, vendedor_id, created_at')
            .not('vendedor_id', 'is', null)
            .gte('created_at', periodStart)
            .lte('created_at', now),
        ]);

        if (representativesResult.error) {
          throw representativesResult.error;
        }

        if (activityResult.error) {
          throw activityResult.error;
        }

        if (leadsResult.error) {
          throw leadsResult.error;
        }

        const activityByRepresentative = new Map();

        for (const activity of activityResult.data ?? []) {
          const current =
            activityByRepresentative.get(activity.vendedor_id) ?? {
              activities: 0,
              catalogs: 0,
            };

          current.activities += 1;

          if (activity.tipo === 'catalogo_gerado') {
            current.catalogs += 1;
          }

          activityByRepresentative.set(
            activity.vendedor_id,
            current
          );
        }

        const leadsByRepresentative = new Map();

        for (const lead of leadsResult.data ?? []) {
          leadsByRepresentative.set(
            lead.vendedor_id,
            (leadsByRepresentative.get(lead.vendedor_id) ?? 0) + 1
          );
        }

        const nextRows = (representativesResult.data ?? [])
          .map((representative) => {
            const activity =
              activityByRepresentative.get(representative.id) ?? {
                activities: 0,
                catalogs: 0,
              };

            return {
              id: representative.id,
              name:
                representative.nome ||
                representative.email ||
                'Representante',
              activities: activity.activities,
              catalogs: activity.catalogs,
              leads:
                leadsByRepresentative.get(representative.id) ?? 0,
            };
          })
          .sort(
            (a, b) =>
              b.activities - a.activities ||
              b.catalogs - a.catalogs ||
              b.leads - a.leads ||
              a.name.localeCompare(b.name, 'pt-BR')
          );

        if (!cancelled) {
          setRows(nextRows);
        }
      } catch (err) {
        console.error(
          'Erro ao carregar atividade por representante:',
          err
        );

        if (!cancelled) {
          setRows([]);
          setError(
            'Não foi possível carregar a atividade dos representantes.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRepresentativeActivity();

    return () => {
      cancelled = true;
    };
  }, [periodStart]);

  return (
    <section className="admin2-overview-block admin2-representative-activity">
      <div className="admin2-overview-block-heading">
        <div>
          <h2>Atividade por representante</h2>
          <p>
            Uso comercial dos representantes no período selecionado.
          </p>
        </div>
      </div>

      {period === 'custom' ? (
        <div className="admin2-representative-empty">
          Defina o período personalizado para visualizar os dados.
        </div>
      ) : error ? (
        <div className="admin2-form-error">
          {error}
        </div>
      ) : loading ? (
        <div className="admin2-representative-empty">
          Carregando representantes...
        </div>
      ) : rows.length === 0 ? (
        <div className="admin2-representative-empty">
          Nenhum representante cadastrado.
        </div>
      ) : (
        <div className="admin2-representative-table">
          <div className="admin2-representative-row is-header">
            <span>Representante</span>
            <span>Atividades</span>
            <span>Catálogos gerados</span>
            <span>Leads</span>
          </div>

          {rows.map((row) => (
            <div
              className="admin2-representative-row"
              key={row.id}
            >
              <strong>{row.name}</strong>

              <span>
                {row.activities.toLocaleString('pt-BR')}
              </span>

              <span>
                {row.catalogs.toLocaleString('pt-BR')}
              </span>

              <span>
                {row.leads.toLocaleString('pt-BR')}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}