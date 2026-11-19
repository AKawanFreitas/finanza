import { useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { fmt } from '../../utils/formatters';
import { MONTH_NAMES, shiftYM, daysInMonth } from '../../utils/period';
import MonthStepper from '../../components/MonthStepper';
import Kpi from './Kpi';
import DailyBars from './DailyBars';
import MonthHistory from './MonthHistory';
import CategoryDonut from './CategoryDonut';
import MovementsTable from './MovementsTable';

const HISTORY_MONTHS = 6;

const sum = (list, tipo) => list.filter(t => t.tipo === tipo).reduce((a, t) => a + t.valor, 0);

// Variação em relação ao mês anterior, como chip. `goodWhenUp` define a cor.
function delta(atual, anterior, mesAnterior, goodWhenUp) {
  if (!anterior) return null;
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  if (pct === 0) return { text: `= ${mesAnterior}`, cls: 'neutral' };
  const up = pct > 0;
  return { text: `${up ? '▲' : '▼'} ${Math.abs(pct)}% vs. ${mesAnterior}`, cls: up === goodWhenUp ? 'good' : 'bad' };
}

export default function Dashboard({ ym, onYmChange, onNavigate }) {
  const { transactions, recorrentes, categorias } = useFinance();

  const data = useMemo(() => {
    const byMonth = m => transactions.filter(t => t.data.startsWith(m));
    const month   = byMonth(ym);
    const prev    = byMonth(shiftYM(ym, -1));

    const days = Array(daysInMonth(ym)).fill(0);
    const catMap = {};
    month.filter(t => t.tipo === 'saida').forEach(t => {
      days[Number(t.data.slice(8)) - 1] += t.valor;
      catMap[t.cat] = (catMap[t.cat] || 0) + t.valor;
    });

    const history = Array.from({ length: HISTORY_MONTHS }, (_, i) => {
      const m = shiftYM(ym, i - (HISTORY_MONTHS - 1));
      const list = byMonth(m);
      return { ym: m, rec: sum(list, 'entrada'), gas: sum(list, 'saida') };
    });

    return {
      month, days, history,
      rec: sum(month, 'entrada'), gas: sum(month, 'saida'),
      prevRec: sum(prev, 'entrada'), prevGas: sum(prev, 'saida'),
      sorted: Object.entries(catMap).sort((a, b) => b[1] - a[1]),
    };
  }, [transactions, ym]);

  const { month, rec, gas, prevRec, prevGas, history } = data;
  const saldo = rec - gas;
  const [anoStr, mesStr] = ym.split('-');
  const mesNome     = MONTH_NAMES[Number(mesStr) - 1];
  const mesAnterior = MONTH_NAMES[(Number(mesStr) + 10) % 12].slice(0, 3).toLowerCase();
  const fixos       = recorrentes.filter(r => r.tipo === 'fixo');
  const fixosTotal  = fixos.reduce((a, r) => a + r.valor, 0);
  const spentPct    = rec > 0 ? Math.min(100, Math.round((gas / rec) * 100)) : null;
  const health = spentPct === null ? null
    : spentPct >= 90 ? { label: 'Atenção: gastos elevados', cls: 'bad' }
    : spentPct >= 70 ? { label: 'Moderado', cls: 'warn' }
    : { label: 'Saudável', cls: 'good' };

  return (
    <div>
      <header className="page-bar">
        <div>
          <h1 className="page-title">Resumo</h1>
          <p className="page-subtitle">{mesNome} de {anoStr}, {month.length} {month.length === 1 ? 'movimentação' : 'movimentações'}</p>
        </div>
        <MonthStepper ym={ym} onChange={onYmChange} />
      </header>

      <section className="kpis" aria-label="Indicadores do mês">
        <Kpi
          tone="brand" label="Saldo do mês" value={fmt(saldo)}
          chip={{ text: saldo >= 0 ? 'Superávit' : 'Déficit', cls: 'on-brand' }}
          note="Receitas menos gastos"
        />
        <Kpi
          label="Receitas" value={fmt(rec)}
          chip={delta(rec, prevRec, mesAnterior, true)}
          note={`${month.filter(t => t.tipo === 'entrada').length} entradas`}
          spark={history.map(h => h.rec)}
        />
        <Kpi
          label="Gastos" value={fmt(gas)}
          chip={delta(gas, prevGas, mesAnterior, false)}
          note={`${month.filter(t => t.tipo === 'saida').length} saídas`}
          spark={history.map(h => h.gas)}
        />
        <Kpi
          label="Contas fixas" value={fmt(fixosTotal)}
          note={`${fixos.length} ${fixos.length === 1 ? 'item' : 'itens'} por mês`}
        />
      </section>

      {month.length === 0 ? (
        <section className="panel">
          <div className="panel-head"><h2>Nenhum lançamento em {mesNome.toLowerCase()}</h2></div>
          <div className="panel-body empty-state">
            <p>Registre uma entrada ou saída para ver os gráficos e a divisão por categoria deste mês.</p>
            <button className="btn btn-primary" onClick={() => onNavigate('lancamento')}>Adicionar lançamento</button>
          </div>
        </section>
      ) : (
        <div className="dash-grid">
          <div className="dash-col">
            <section className="panel">
              <div className="panel-head"><h2>Gastos por dia</h2></div>
              <div className="panel-body"><DailyBars days={data.days} ym={ym} /></div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Últimas movimentações</h2>
                {month.length > 8 && <button className="link-btn" onClick={() => onNavigate('lancamento')}>Ver todas</button>}
              </div>
              <MovementsTable transactions={month} categorias={categorias} />
            </section>
          </div>

          <div className="dash-col">
            <section className="panel">
              <div className="panel-head"><h2>Gastos por categoria</h2></div>
              <div className="panel-body"><CategoryDonut sorted={data.sorted} categorias={categorias} /></div>
            </section>

            {health && (
              <section className="panel">
                <div className="panel-head">
                  <h2>Comprometimento da renda</h2>
                  <span className={`chip ${health.cls}`}>{health.label}</span>
                </div>
                <div className="panel-body">
                  <div className="meter-big">{spentPct}%</div>
                  <div className="meter-track" role="img" aria-label={`${spentPct}% da receita foi gasta`}>
                    <div className={`meter-fill ${health.cls}`} style={{ width: `${spentPct}%` }} />
                  </div>
                  <p className="meter-note">da receita do mês já foi gasto</p>
                </div>
              </section>
            )}

            <section className="panel">
              <div className="panel-head"><h2>Últimos {HISTORY_MONTHS} meses</h2></div>
              <div className="panel-body"><MonthHistory history={history} ym={ym} /></div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
