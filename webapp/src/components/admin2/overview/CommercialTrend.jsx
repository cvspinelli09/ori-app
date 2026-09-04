import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { supabase } from '../../../lib/supabase';

const PERIOD_CONFIG = {
  '30d': {
    days: 30,
    group: 'day',
  },
  '90d': {
    days: 90,
    group: 'week',
  },
  '6m': {
    months: 6,
    group: 'month',
  },
  '12m': {
    months: 12,
    group: 'month',
  },
};

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function getPeriodStart(period) {
  const config = PERIOD_CONFIG[period];

  if (!config) return null;

  const now = new Date();

  if (config.days) {
    const start = startOfDay(now);
    start.setDate(start.getDate() - (config.days - 1));
    return start;
  }

  if (config.months) {
    const start = new Date(
      now.getFullYear(),
      now.getMonth() - (config.months - 1),
      1
    );

    return start;
  }

  return null;
}

function formatDayLabel(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

function formatMonthLabel(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
  })
    .format(date)
    .replace('.', '');
}

function createDailyBuckets(start, end) {
  const buckets = [];
  const cursor = startOfDay(start);
  const finalDate = startOfDay(end);

  while (cursor <= finalDate) {
    const bucketStart = new Date(cursor);
    const bucketEnd = new Date(cursor);
    bucketEnd.setHours(23, 59, 59, 999);

    buckets.push({
      key: bucketStart.toISOString().slice(0, 10),
      label: formatDayLabel(bucketStart),
      start: bucketStart,
      end: bucketEnd,
      activeClientIds: new Set(),
      selections: 0,
      leads: 0,
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return buckets;
}

function createWeeklyBuckets(start, end) {
  const buckets = [];
  const cursor = startOfDay(start);
  const finalDate = new Date(end);

  let index = 0;

  while (cursor <= finalDate) {
    const bucketStart = new Date(cursor);
    const bucketEnd = new Date(cursor);
    bucketEnd.setDate(bucketEnd.getDate() + 6);
    bucketEnd.setHours(23, 59, 59, 999);

    if (bucketEnd > finalDate) {
      bucketEnd.setTime(finalDate.getTime());
    }

    buckets.push({
      key: `week-${index}`,
      label: formatDayLabel(bucketStart),
      start: bucketStart,
      end: bucketEnd,
      activeClientIds: new Set(),
      selections: 0,
      leads: 0,
    });

    cursor.setDate(cursor.getDate() + 7);
    index += 1;
  }

  return buckets;
}

function createMonthlyBuckets(start, end) {
  const buckets = [];

  const cursor = new Date(
    start.getFullYear(),
    start.getMonth(),
    1
  );

  const finalMonth = new Date(
    end.getFullYear(),
    end.getMonth(),
    1
  );

  while (cursor <= finalMonth) {
    const bucketStart = new Date(cursor);

    const bucketEnd = new Date(
      cursor.getFullYear(),
      cursor.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    buckets.push({
      key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
      label: formatMonthLabel(cursor),
      start: bucketStart,
      end: bucketEnd,
      activeClientIds: new Set(),
      selections: 0,
      leads: 0,
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return buckets;
}

function createBuckets(period, start, end) {
  const group = PERIOD_CONFIG[period]?.group;

  if (group === 'day') {
    return createDailyBuckets(start, end);
  }

  if (group === 'week') {
    return createWeeklyBuckets(start, end);
  }

  return createMonthlyBuckets(start, end);
}

function findBucket(buckets, timestamp) {
  const date = new Date(timestamp);

  return buckets.find(
    (bucket) =>
      date >= bucket.start &&
      date <= bucket.end
  );
}

export function CommercialTrend({ period = '30d' }) {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const periodStart = useMemo(
    () => getPeriodStart(period),
    [period]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadTrend() {
      if (!periodStart) {
        setChartData([]);
        setLoading(false);
        setError('');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const now = new Date();

        const [
          clientsResult,
          selectionsResult,
          leadsResult,
        ] = await Promise.all([
          supabase
            .from('profiles')
            .select('id')
            .eq('role', 'cliente'),

          supabase
            .from('catalogo_selecoes')
            .select('id, user_id, updated_at')
            .gte('updated_at', periodStart.toISOString())
            .lte('updated_at', now.toISOString()),

          supabase
            .from('leads')
            .select('id, created_at')
            .gte('created_at', periodStart.toISOString())
            .lte('created_at', now.toISOString()),
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
          (clientsResult.data ?? []).map(
            (client) => client.id
          )
        );

        const buckets = createBuckets(
          period,
          periodStart,
          now
        );

        for (const selection of selectionsResult.data ?? []) {
          const bucket = findBucket(
            buckets,
            selection.updated_at
          );

          if (!bucket) continue;

          bucket.selections += 1;

          if (clientIds.has(selection.user_id)) {
            bucket.activeClientIds.add(
              selection.user_id
            );
          }
        }

        for (const lead of leadsResult.data ?? []) {
          const bucket = findBucket(
            buckets,
            lead.created_at
          );

          if (!bucket) continue;

          bucket.leads += 1;
        }

        const nextChartData = buckets.map(
          (bucket) => ({
            label: bucket.label,
            clientesAtivos:
              bucket.activeClientIds.size,
            selecoes: bucket.selections,
            leads: bucket.leads,
          })
        );

        if (!cancelled) {
          setChartData(nextChartData);
        }
      } catch (err) {
        console.error(
          'Erro ao carregar evolução comercial:',
          err
        );

        if (!cancelled) {
          setError(
            'Não foi possível carregar a evolução comercial.'
          );
          setChartData([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTrend();

    return () => {
      cancelled = true;
    };
  }, [period, periodStart]);

  if (period === 'custom') {
    return (
      <section className="admin2-overview-block admin2-commercial-trend">
        <div className="admin2-overview-block-heading">
          <div>
            <h2>Evolução comercial</h2>
            <p>
              Clientes ativos, seleções salvas e leads gerados.
            </p>
          </div>
        </div>

        <div className="admin2-commercial-trend-empty">
          Defina o período personalizado para visualizar a evolução.
        </div>
      </section>
    );
  }

  return (
    <section className="admin2-overview-block admin2-commercial-trend">
      <div className="admin2-overview-block-heading">
        <div>
          <h2>Evolução comercial</h2>
          <p>
            Clientes ativos, seleções salvas e leads gerados.
          </p>
        </div>
      </div>

      {error ? (
        <div className="admin2-form-error">
          {error}
        </div>
      ) : loading ? (
        <div className="admin2-commercial-trend-empty">
          Carregando evolução comercial...
        </div>
      ) : (
        <div className="admin2-commercial-trend-chart">
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <LineChart
              data={chartData}
              margin={{
                top: 10,
                right: 12,
                bottom: 0,
                left: -18,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
              />

              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                minTickGap={24}
                fontSize={11}
              />

              <YAxis
                allowDecimals={false}
                domain={[0, 'auto']}
                tickLine={false}
                axisLine={false}
                fontSize={11}
              />

              <Tooltip />

              <Legend
                align="right"
                height={36}
                payload={[
                    {
                    value: 'Clientes ativos',
                    type: 'line',
                    color: '#2563eb',
                    },
                    {
                    value: 'Seleções salvas',
                    type: 'line',
                    color: '#0f766e',
                    },
                    {
                    value: 'Leads gerados',
                    type: 'line',
                    color: '#c2410c',
                    },
                ]}
                />

              <Line
                type="linear"
                dataKey="clientesAtivos"
                name="Clientes ativos"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />

              <Line
                type="linear"
                dataKey="selecoes"
                name="Seleções salvas"
                stroke="#0f766e"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />

              <Line
                type="linear"
                dataKey="leads"
                name="Leads gerados"
                stroke="#c2410c"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}