import { useMemo } from 'react';
import { Wallet, TrendingUp, TrendingDown, Bookmark, Activity } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { fmt } from '../../utils/formatters';
import { periodToYM, shiftYM, MONTH_ABBR } from '../../utils/period';
import MetricCard from './MetricCard';
import LineChart from './LineChart';
import DonutChart from './DonutChart';
import CategoryBars from './CategoryBars';
import RecentTransactions from './RecentTransactions';

// Variação em relação ao mês anterior; sem base de comparação, mostra só a contagem.
function delta(atual, anterior, mes, goodWhenUp, fallback) {
  if (!anterior) return { pill: fallback, pillClass: 'neu' };
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  if (pct === 0) return { pill: `Igual a ${mes}`, pillClass: 'neu' };
  const up = pct > 0;
  return {
    pill: `${up ? '▲' : '▼'} ${Math.abs(pct)}% vs. ${mes}`,
    pillClass: up === goodWhenUp ? 'up' : 'dn',
  };
}

function healthScore(rec, gas) {
  if (rec === 0) return 0;
  const pct = Math.min(100, Math.round((gas / rec) * 100));
  return pct;
}

export default function Dashboard({ period }) {
  const { transactions, recorrentes, categorias } = useFinance();

  const ym     = periodToYM(period);
  const prevYM = shiftYM(ym, -1);

  const { rec, gas, fixo, saldo, sorted, filtered, txCount, prevRec, prevGas } = useMemo(() => {
    const total = (list, tipo) => list.filter(t => t.tipo === tipo).reduce((a, t) => a + t.valor, 0);
    const prev     = transactions.filter(t => t.data.startsWith(prevYM));
    const prevRec  = total(prev, 'entrada');
    const prevGas  = total(prev, 'saida');
    const filtered = transactions.filter(t => t.data.startsWith(ym));
    const rec      = total(filtered, 'entrada');
    const gas      = total(filtered, 'saida');
    const fixo     = recorrentes.filter(r => r.tipo === 'fixo').reduce((a, r) => a + r.valor, 0);
    const catMap   = {};
    filtered.filter(t => t.tipo === 'saida').forEach(t => {
      catMap[t.cat] = (catMap[t.cat] || 0) + t.valor;
    });
    const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
    return { rec, gas, fixo, saldo: rec - gas, sorted, filtered, txCount: filtered.length, prevRec, prevGas };
  }, [transactions, recorrentes, ym, prevYM]);

  const prevMes   = MONTH_ABBR[Number(prevYM.slice(5)) - 1].toLowerCase();
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
          {...delta(rec, prevRec, prevMes, true, `${filtered.filter(t=>t.tipo==='entrada').length} entradas`)}
        />
        <MetricCard
          accent="r" icon={TrendingDown} label="Gastos" value={fmt(gas)}
          {...delta(gas, prevGas, prevMes, false, `${filtered.filter(t=>t.tipo==='saida').length} saídas`)}
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
              <span><span className="legend-dot" style={{ background: '#1d8f3e' }} />Receitas</span>
              <span><span className="legend-dot" style={{ background: '#0e1726' }} />Gastos</span>
            </div>
          </div>
          <div style={{ position: 'relative', height: 200 }}>
            <LineChart ym={ym} />
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
