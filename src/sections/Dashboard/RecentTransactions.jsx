import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { fmt, fmtDate, getCatColor, catIcon } from '../../utils/formatters';

export default function RecentTransactions({ transactions, categorias }) {
  const recent = [...transactions].sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id).slice(0, 5);

  if (recent.length === 0) {
    return <div className="empty">Nenhuma transação no período.</div>;
  }

  return (
    <div className="tx-rows">
      {recent.map(t => {
        const CatIcon = catIcon(t.cat);
        const color   = getCatColor(categorias, t.cat);
        const isIn    = t.tipo === 'entrada';
        return (
          <div key={t.id} className="tx-row">
            <div className="tx-left">
              <div className="tx-avatar" style={{ background: color + '18', color }}>
                <CatIcon size={15} strokeWidth={2} />
              </div>
              <div>
                <div className="tx-name">{t.desc}</div>
                <div className="tx-meta">{t.cat} · {fmtDate(t.data)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {isIn
                ? <ArrowDownLeft size={14} color="var(--green)" strokeWidth={2.5} />
                : <ArrowUpRight  size={14} color="var(--red)"   strokeWidth={2.5} />
              }
              <span className={`tx-amount ${isIn ? 'in' : 'out'}`}>
                {isIn ? '+' : '-'}{fmt(t.valor)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
