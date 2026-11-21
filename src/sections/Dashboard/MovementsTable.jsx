import { fmt, fmtDate, getCatColor } from '../../utils/formatters';

export default function MovementsTable({ transactions, categorias, limit = 8 }) {
  const recent = [...transactions]
    .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)
    .slice(0, limit);

  if (recent.length === 0) return <p className="empty">Nenhuma movimentação neste mês.</p>;

  return (
    <table className="table table-mov">
      <thead>
        <tr>
          <th>Data</th>
          <th>Descrição</th>
          <th>Categoria</th>
          <th className="num">Valor</th>
        </tr>
      </thead>
      <tbody>
        {recent.map(t => (
          <tr key={t.id}>
            <td className="muted">{fmtDate(t.data).slice(0, 5)}</td>
            <td className="strong">{t.desc}<span className="mov-cat">{t.cat}</span></td>
            <td>
              <span className="tag-chip">
                <span className="dot" style={{ background: getCatColor(categorias, t.cat) }} />
                {t.cat}
              </span>
            </td>
            <td className={`num strong ${t.tipo === 'entrada' ? 'pos' : ''}`}>
              {t.tipo === 'entrada' ? '+' : '−'} {fmt(t.valor)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
