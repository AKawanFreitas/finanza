import { useMemo } from 'react';
import { Wallet, TrendingUp, TrendingDown, Bookmark, Activity } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { fmt } from '../../utils/formatters';
import MetricCard from './MetricCard';
import LineChart from './LineChart';
import DonutChart from './DonutChart';
import CategoryBars from './CategoryBars';
import RecentTransactions from './RecentTransactions';

const MONTH_MAP = {
  'Janeiro':'01','Fevereiro':'02','Março':'03','Abril':'04',
  'Maio':'05','Junho':'06','Julho':'07','Agosto':'08',
  'Setembro':'09','Outubro':'10','Novembro':'11','Dezembro':'12',
};

function periodToYM(period) {
  const [mName, year] = period.split(' ');
  return `${year}-${MONTH_MAP[mName]}`;
}

function healthScore(rec, gas) {
  if (rec === 0) return 0;
  const pct = Math.min(100, Math.round((gas / rec) * 100));
  return pct;
}

export default function Dashboard({ period }) {
  const { transactions, recorrentes, categorias } = useFinance();

  const { rec, gas, fixo, saldo, sorted, filtered, txCount } = useMemo(() => {
    const ym       = periodToYM(period);
    const filtered = transactions.filter(t => t.data.startsWith(ym));
    const rec      = filtered.filter(t => t.tipo === 'entrada').reduce((a, t) => a + t.valor, 0);
    const gas      = filtered.filter(t => t.tipo === 'saida').reduce((a, t) => a + t.valor, 0);
    const fixo     = recorrentes.filter(r => r.tipo === 'fixo').reduce((a, r) => a + r.valor, 0);
    const catMap   = {};
    filtered.filter(t => t.tipo === 'saida').forEach(t => {
      catMap[t.cat] = (catMap[t.cat] || 0) + t.valor;
    });
    const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
    return { rec, gas, fixo, saldo: rec - gas, sorted, filtered, txCount: filtered.length };
  }, [transactions, recorrentes, period]);

  const fixoCount = recorrentes.filter(r => r.tipo === 'fixo').length;
  const spendPct  = healthScore(rec, gas);

  const healthColor = spendPct >= 90 ? 'var(--red)'
    : spendPct >= 70 ? 'var(--amber)'
    : 'var(--green)';

  const healthLabel = spendPct >= 90 ? 'Atenção: gastos elevados'
    : spendPct >= 70 ? 'Moderado'
    : rec === 0 ? 'Sem dados'
    : 'Saudável';

  return (
    <div className="section-enter">
      <div className="page-header">
        <div>
          <div className="page-title">Visão Geral</div>
          <div className="page-subtitle">{period} · {txCount} transações</div>
        </div>
      </div>

      {/* Métricas */}
      <div className="metrics-row">
        <MetricCard
          accent="g" icon={Wallet} label="Saldo do período" value={fmt(saldo)}
          pill={saldo >= 0 ? '▲ Superávit' : '▼ Déficit'}
          pillClass={saldo >= 0 ? 'up' : 'dn'}
        />
        <MetricCard
          accent="b" icon={TrendingUp} label="Receitas" value={fmt(rec)}
          pill={`${filtered.filter(t=>t.tipo==='entrada').length} entradas`} pillClass="neu"
        />
        <MetricCard
          accent="r" icon={TrendingDown} label="Gastos" value={fmt(gas)}
          pill={`${filtered.filter(t=>t.tipo==='saida').length} saídas`} pillClass="dn"
        />
        <MetricCard
          accent="a" icon={Bookmark} label="Fixos mensais" value={fmt(fixo)}
          pill={`${fixoCount} ${fixoCount === 1 ? 'item' : 'itens'}`} pillClass="neu"
        />
      </div>

      {/* Banner saúde financeira */}
      {rec > 0 && (
        <div className="health-banner">
          <Activity size={16} color={healthColor} strokeWidth={2} />
          <div className="health-label">Saúde financeira</div>
          <div className="health-track">
            <div
              className="health-fill"
              style={{ width: `${spendPct}%`, background: healthColor }}
            />
          </div>
          <div className="health-value" style={{ color: healthColor }}>
            {spendPct}% comprometido
          </div>
          <div className="health-desc">— {healthLabel}</div>
        </div>
      )}

      {/* Gráficos */}
      <div className="charts-row">
        <div className="card">
          <div className="card-head">
            <div className="card-title">Evolução mensal</div>
            <div className="chart-legend">
              <span><span className="legend-dot" style={{ background: '#22a84a' }} />Receitas</span>
              <span><span className="legend-dot" style={{ background: '#e84057' }} />Gastos</span>
            </div>
          </div>
          <div style={{ position: 'relative', height: 200 }}>
            <LineChart />
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <div className="card-title">Por categoria</div>
            <div className="card-sub">{gas > 0 ? fmt(gas) + ' em gastos' : 'Sem gastos'}</div>
          </div>
          <div style={{ position: 'relative', height: 200 }}>
            <DonutChart sorted={sorted} categorias={categorias} />
          </div>
        </div>
      </div>

      {/* Inferior */}
      <div className="bottom-row">
        <div className="card">
          <div className="card-head">
            <div className="card-title">Gastos por categoria</div>
            <div className="card-sub">{sorted.length} categorias</div>
          </div>
          <CategoryBars sorted={sorted} categorias={categorias} />
        </div>
        <div className="card">
          <div className="card-head">
            <div className="card-title">Últimas transações</div>
            <div className="card-sub">{txCount} no período</div>
          </div>
          <RecentTransactions transactions={filtered} categorias={categorias} />
        </div>
      </div>
    </div>
  );
}
