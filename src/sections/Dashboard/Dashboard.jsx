import { useMemo } from 'react';
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

export default function Dashboard({ period }) {
  const { transactions, recorrentes, categorias } = useFinance();

  const { rec, gas, fixo, saldo, sorted, filtered } = useMemo(() => {
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
    return { rec, gas, fixo, saldo: rec - gas, sorted, filtered };
  }, [transactions, recorrentes, period]);

  const fixoCount = recorrentes.filter(r => r.tipo === 'fixo').length;

  return (
    <div className="section-enter">
      <div className="page-header">
        <div>
          <div className="page-title">Visão Geral</div>
          <div className="page-subtitle">{period} · atualizado agora</div>
        </div>
      </div>

      <div className="metrics-row">
        <MetricCard
          accent="g" icon="💰" label="Saldo atual" value={fmt(saldo)}
          pill={saldo >= 0 ? '▲ Superávit' : '▼ Déficit'}
          pillClass={saldo >= 0 ? 'up' : 'dn'}
        />
        <MetricCard accent="b" icon="📥" label="Receitas" value={fmt(rec)} pill="▲ mês atual" pillClass="up" />
        <MetricCard accent="r" icon="📤" label="Gastos"   value={fmt(gas)} pill="▼ mês atual" pillClass="dn" />
        <MetricCard
          accent="a" icon="📌" label="Fixos mensais" value={fmt(fixo)}
          pill={`${fixoCount} itens fixos`} pillClass="neu"
        />
      </div>

      <div className="charts-row">
        <div className="card">
          <div className="card-head">
            <div className="card-title">Evolução mensal</div>
            <div className="chart-legend">
              <span><span className="legend-dot" style={{ background: '#00d68f' }} />Receitas</span>
              <span><span className="legend-dot" style={{ background: '#ff6b6b' }} />Gastos</span>
            </div>
          </div>
          <div style={{ position: 'relative', height: 190 }}>
            <LineChart />
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <div className="card-title">Por categoria</div>
            <div className="card-sub">{fmt(gas)} em gastos</div>
          </div>
          <div style={{ position: 'relative', height: 190 }}>
            <DonutChart sorted={sorted} categorias={categorias} />
          </div>
        </div>
      </div>

      <div className="bottom-row">
        <div className="card">
          <div className="card-head"><div className="card-title">Categorias</div></div>
          <CategoryBars sorted={sorted} categorias={categorias} />
        </div>
        <div className="card">
          <div className="card-head">
            <div className="card-title">Últimas transações</div>
            <div className="card-sub">{filtered.length} no período</div>
          </div>
          <RecentTransactions transactions={filtered} categorias={categorias} />
        </div>
      </div>
    </div>
  );
}
