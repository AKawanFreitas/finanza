import { fmt, getCatColor, catIcon } from '../../utils/formatters';

export default function RecentTransactions({ transactions, categorias }) {
  const recent = [...transactions].sort((a, b) => b.id - a.id).slice(0, 5);
  return (
    <div className="tx-rows">
      {recent.map(t => (
        <div key={t.id} className="tx-row">
          <div className="tx-left">
            <div className="tx-avatar" style={{ background: getCatColor(categorias, t.cat) + '18' }}>
              {catIcon(t.cat)}
            </div>
            <div>
              <div className="tx-name">{t.desc}</div>
              <div className="tx-meta">{t.cat} · {t.data}</div>
            </div>
          </div>
          <div className={`tx-amount ${t.tipo === 'entrada' ? 'in' : 'out'}`}>
            {t.tipo === 'entrada' ? '+' : '-'}{fmt(t.valor)}
          </div>
        </div>
      ))}
    </div>
  );
}
