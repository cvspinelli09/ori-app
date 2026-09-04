import { useState } from 'react';

import './OverviewSection.css';

import { OverviewKpis } from './overview/OverviewKpis';
import { CommercialTrend } from './overview/CommercialTrend';
import { RepresentativeActivity } from './overview/RepresentativeActivity';
import { TopProducts } from './overview/TopProducts';
import { RegionalDistribution } from './overview/RegionalDistribution';
import { RecentLeads } from './overview/RecentLeads';

export function OverviewSection() {
  const [period, setPeriod] = useState('30d');

  return (
    <section className="admin2-overview">
      <div className="admin2-overview-toolbar">
        <div>
          <strong>Período de análise</strong>
          <span>
            O período selecionado atualiza os indicadores e análises abaixo.
          </span>
        </div>

        <select
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
          aria-label="Período da visão geral"
        >
          <option value="30d">Últimos 30 dias</option>
          <option value="90d">Últimos 90 dias</option>
          <option value="6m">Últimos 6 meses</option>
          <option value="12m">Últimos 12 meses</option>
          <option value="custom">Personalizado</option>
        </select>
      </div>

      <OverviewKpis period={period} />

      <CommercialTrend period={period} />

      <div className="admin2-overview-grid">
        <RepresentativeActivity period={period} />
        <TopProducts period={period} />
      </div>

      <RegionalDistribution period={period} />

      <RecentLeads period={period} />
    </section>
  );
}