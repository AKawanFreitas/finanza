import { fmt, getCatColor, catIcon } from '../../utils/formatters';

export default function CategoryBars({ sorted, categorias }) {
  const max = sorted[0]?.[1] || 1;

  if (sorted.length === 0) {
    return <div className="empty">Sem gastos no período.</div>;
  }

  return (
    <div className="cat-rows">
      {sorted.slice(0, 6).map(([cat, val]) => {
        const CatIcon = catIcon(cat);
        const color   = getCatColor(categorias, cat);
        return (
          <div key={cat} className="cat-row">
            <div className="cat-row-icon" style={{ background: color + '18', color }}>
              <CatIcon size={13} strokeWidth={2} />
            </div>
            <div className="cat-row-name">{cat}</div>
            <div className="cat-row-bar-wrap">
              <div
                className="cat-row-bar"
                style={{ width: `${Math.round(val / max * 100)}%`, background: color }}
              />
            </div>
            <div className="cat-row-val">{fmt(val)}</div>
          </div>
        );
      })}
    </div>
  );
}
