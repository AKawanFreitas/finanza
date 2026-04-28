import { fmt, getCatColor } from '../../utils/formatters';

export default function CategoryBars({ sorted, categorias }) {
  const max = sorted[0]?.[1] || 1;
  return (
    <div className="cat-rows">
      {sorted.slice(0, 6).map(([cat, val]) => (
        <div key={cat} className="cat-row">
          <div className="cat-row-name">{cat}</div>
          <div className="cat-row-bar-wrap">
            <div
              className="cat-row-bar"
              style={{ width: `${Math.round(val / max * 100)}%`, background: getCatColor(categorias, cat) }}
            />
          </div>
          <div className="cat-row-val">{fmt(val)}</div>
        </div>
      ))}
    </div>
  );
}
