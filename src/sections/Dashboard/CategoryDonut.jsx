import CategoriaIcone from '../../components/CategoriaIcone';
import { fmt, getCatColor } from '../../utils/formatters';

// Rosca feita com conic-gradient: sem biblioteca de gráficos.
export default function CategoryDonut({ sorted, categorias }) {
  const total = sorted.reduce((a, [, v]) => a + v, 0);
  if (total === 0) return <p className="empty">Sem gastos neste mês.</p>;

  let acc = 0;
  const stops = sorted.map(([nome, v]) => {
    const from = (acc / total) * 100;
    acc += v;
    return `${getCatColor(categorias, nome)} ${from}% ${(acc / total) * 100}%`;
  });

  return (
    <div className="donut-wrap">
      <div className="donut" style={{ background: `conic-gradient(${stops.join(', ')})` }} role="img" aria-label="Gastos por categoria">
        <div className="donut-hole">
          <small>Total</small>
          <strong>{fmt(total)}</strong>
        </div>
      </div>
      <ul className="donut-legend">
        {sorted.map(([nome, v]) => (
          <li key={nome}>
            <CategoriaIcone icone={categorias.find(c => c.nome === nome)?.icone} cor={getCatColor(categorias, nome)} tam={26} />
            <span className="legend-name">{nome}</span>
            <span className="legend-pct">{Math.round((v / total) * 100)}%</span>
            <span className="legend-val">{fmt(v)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
