import { Trophy } from 'lucide-react';
import { fmt } from '../../utils/formatters';

// Gasto de cada dia do mês. O dia de maior gasto fica em destaque.
export default function DailyBars({ days, ym }) {
  const max  = Math.max(...days);
  const peak = max > 0 ? days.indexOf(max) : -1;
  const mm   = ym.slice(5);

  return (
    <figure className="daily">
      <div className="daily-plot">
        {days.map((v, i) => (
          <div
            key={i}
            className="daily-col"
            title={`${String(i + 1).padStart(2, '0')}/${mm}: ${v ? fmt(v) : 'sem gastos'}`}
          >
            <span
              className={`daily-bar${i === peak ? ' peak' : ''}${v === 0 ? ' is-zero' : ''}`}
              style={{ height: v ? `${Math.max(4, (v / max) * 100)}%` : undefined }}
            />
          </div>
        ))}
      </div>
      <div className="daily-ticks" aria-hidden="true">
        {days.map((_, i) => (
          <span key={i} className="daily-tick">{(i + 1) % 5 === 0 || i === 0 ? i + 1 : ''}</span>
        ))}
      </div>
      <figcaption>
        {peak >= 0
          ? <><Trophy size={16} /><span>Maior gasto no dia {peak + 1}: <strong>{fmt(max)}</strong></span></>
          : 'Nenhum gasto registrado neste mês.'}
      </figcaption>
    </figure>
  );
}
