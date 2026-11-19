import { fmt } from '../../utils/formatters';
import { MONTH_ABBR } from '../../utils/period';

// Receitas e gastos dos últimos meses, em barras pareadas.
export default function MonthHistory({ history, ym }) {
  const max = Math.max(...history.flatMap(h => [h.rec, h.gas]), 1);

  return (
    <div className="history">
      {history.map(h => (
        <div
          key={h.ym}
          className={`history-col${h.ym === ym ? ' current' : ''}`}
          title={`${MONTH_ABBR[Number(h.ym.slice(5)) - 1]}: receitas ${fmt(h.rec)}, gastos ${fmt(h.gas)}`}
        >
          <div className="history-bars">
            <span className="history-bar in"  style={{ height: `${(h.rec / max) * 100}%` }} />
            <span className="history-bar out" style={{ height: `${(h.gas / max) * 100}%` }} />
          </div>
          <span className="history-label">{MONTH_ABBR[Number(h.ym.slice(5)) - 1]}</span>
        </div>
      ))}
      <div className="history-key">
        <span><i className="key-in" /> Receitas</span>
        <span><i className="key-out" /> Gastos</span>
      </div>
    </div>
  );
}
