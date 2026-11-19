import { useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { fmt } from '../../utils/formatters';
import { MONTH_NAMES, shiftYM, daysInMonth } from '../../utils/period';
import DailyBars from './DailyBars';
import MonthHistory from './MonthHistory';
import CategorySplit from './CategorySplit';
import Movements from './Movements';

const HISTORY_MONTHS = 6;

const sum = (list, tipo) => list.filter(t => t.tipo === tipo).reduce((a, t) => a + t.valor, 0);

// "gastos 16% maiores que em setembro"
function compare(nome, atual, anterior, mesAnterior) {
  if (!anterior) return null;
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  if (pct === 0) return `${nome} iguais a ${mesAnterior}`;
  return `${nome} ${Math.abs(pct)}% ${pct > 0 ? 'maiores' : 'menores'} que em ${mesAnterior}`;
}

export default function Dashboard({ ym, onNavigate }) {
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
      month,
      rec: sum(month, 'entrada'),
      gas: sum(month, 'saida'),
      prevRec: sum(prev, 'entrada'),
      prevGas: sum(prev, 'saida'),
      days,
      history,
      sorted: Object.entries(catMap).sort((a, b) => b[1] - a[1]),
    };
  }, [transactions, ym]);

  const { month, rec, gas, prevRec, prevGas } = data;
  const saldo     = rec - gas;
  const [anoStr, mesStr] = ym.split('-');
  const mesNome   = MONTH_NAMES[Number(mesStr) - 1];
  const mesAnterior = MONTH_NAMES[(Number(mesStr) + 10) % 12].toLowerCase();
  const fixos     = recorrentes.filter(r => r.tipo === 'fixo');
  const fixosTotal = fixos.reduce((a, r) => a + r.valor, 0);
  const spentPct  = rec > 0 ? Math.min(100, Math.round((gas / rec) * 100)) : null;

  const comparisons = [
    compare('Gastos', gas, prevGas, mesAnterior),
    compare('receitas', rec, prevRec, mesAnterior),
  ].filter(Boolean);

  if (month.length === 0) {
    return (
      <div>
        <h1 className="hero hero-empty">Nenhum lançamento em {mesNome.toLowerCase()} de {anoStr}.</h1>
        <p className="hero-note">Registre uma entrada ou saída para ver o resumo do mês.</p>
        <button className="btn btn-primary" onClick={() => onNavigate('lancamento')}>Adicionar lançamento</button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="hero">
        Em {mesNome.toLowerCase()} você recebeu <span className="num">{fmt(rec)}</span> e
        gastou <span className="num">{fmt(gas)}</span>.{' '}
        {saldo >= 0 ? 'Sobraram ' : 'Faltaram '}
        <span className={`num ${saldo >= 0 ? 'pos' : 'neg'}`}>{fmt(Math.abs(saldo))}</span>.
      </h1>

      <div className="hero-meta">
        {spentPct !== null && (
          <div className="meter" role="img" aria-label={`${spentPct}% da receita foi gasta`}>
            <div className="meter-track"><div className={`meter-fill${spentPct >= 90 ? ' high' : ''}`} style={{ width: `${spentPct}%` }} /></div>
            <span>{spentPct}% da receita já foi gasto</span>
          </div>
        )}
        {comparisons.length > 0 && <p>{comparisons.join('; ')}.</p>}
        {fixos.length > 0 && (
          <p>Contas fixas somam {fmt(fixosTotal)} por mês, em {fixos.length} {fixos.length === 1 ? 'item' : 'itens'}.</p>
        )}
      </div>

      <div className="dash-grid">
        <div className="dash-col">
          <section className="block">
            <h2>Dia a dia</h2>
            <DailyBars days={data.days} ym={ym} />
          </section>

          <section className="block">
            <h2>Movimentações</h2>
            <Movements transactions={month} categorias={categorias} />
            {month.length > 8 && (
              <button className="link-btn" onClick={() => onNavigate('lancamento')}>Ver todos os lançamentos</button>
            )}
          </section>
        </div>

        <div className="dash-col">
          <section className="block">
            <h2>Para onde foi o dinheiro</h2>
            <CategorySplit sorted={data.sorted} categorias={categorias} />
          </section>

          <section className="block">
            <h2>Últimos {HISTORY_MONTHS} meses</h2>
            <MonthHistory history={data.history} ym={ym} />
          </section>
        </div>
      </div>
    </div>
  );
}
