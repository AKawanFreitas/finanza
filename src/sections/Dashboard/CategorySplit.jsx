import { fmt, getCatColor } from '../../utils/formatters';

// Uma barra só dividida por categoria, seguida da lista com valor e participação.
export default function CategorySplit({ sorted, categorias }) {
  const total = sorted.reduce((a, [, v]) => a + v, 0);
  if (total === 0) return <p className="empty">Sem gastos neste mês.</p>;

  return (
    <div>
      <div className="split-bar" role="img" aria-label="Divisão dos gastos por categoria">
        {sorted.map(([nome, v]) => (
          <span key={nome} style={{ flex: v, background: getCatColor(categorias, nome) }} title={`${nome}: ${fmt(v)}`} />
        ))}
      </div>
      <ul className="split-list">
        {sorted.map(([nome, v]) => (
          <li key={nome}>
            <span className="dot" style={{ background: getCatColor(categorias, nome) }} />
            <span className="split-name">{nome}</span>
            <span className="split-pct">{Math.round((v / total) * 100)}%</span>
            <span className="split-val">{fmt(v)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
