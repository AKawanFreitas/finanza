import { fmt, getCatColor } from '../../utils/formatters';

function dayLabel(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const txt = new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

// Últimas movimentações, agrupadas por dia como num extrato.
export default function Movements({ transactions, categorias, limit = 8 }) {
  const recent = [...transactions]
    .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)
    .slice(0, limit);

  if (recent.length === 0) return <p className="empty">Nenhuma movimentação neste mês.</p>;

  const groups = [];
  recent.forEach(t => {
    const last = groups[groups.length - 1];
    if (last && last.data === t.data) last.items.push(t);
    else groups.push({ data: t.data, items: [t] });
  });

  return (
    <div className="statement">
      {groups.map(g => (
        <section key={g.data} className="statement-day">
          <h3>{dayLabel(g.data)}</h3>
          <ul>
            {g.items.map(t => (
              <li key={t.id}>
                <span className="dot" style={{ background: getCatColor(categorias, t.cat) }} />
                <span className="statement-desc">
                  {t.desc}
                  <small>{t.cat}</small>
                </span>
                <span className={`statement-amount ${t.tipo === 'entrada' ? 'in' : ''}`}>
                  {t.tipo === 'entrada' ? '+' : '−'} {fmt(t.valor)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
