import { useFinance } from '../../context/FinanceContext';
import { fmt, getCatColor, catIcon } from '../../utils/formatters';

export default function TransactionList() {
  const { transactions, categorias, delTransaction } = useFinance();
  const sorted = [...transactions].sort((a, b) => b.id - a.id);

  return (
    <div className="hist-wrap">
      <div className="card-head" style={{ marginBottom: '0.75rem' }}>
        <div className="card-title">Histórico</div>
        <div className="card-sub">{sorted.length} registros</div>
      </div>
      <div className="hist-head">
        <div>Descrição</div><div>Categoria</div><div>Data</div>
        <div style={{ textAlign: 'right' }}>Valor</div><div />
      </div>
      {sorted.length === 0 ? (
        <div className="empty">Nenhuma transação ainda.</div>
      ) : sorted.map(t => (
        <div key={t.id} className="hist-row">
          <div className="hist-desc-wrap">
            <div className="hist-mini-icon" style={{ background: getCatColor(categorias, t.cat) + '18' }}>
              {catIcon(t.cat)}
            </div>
            <div>
              <div style={{ fontSize: 13 }}>{t.desc}</div>
              {t.obs && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{t.obs}</div>}
            </div>
          </div>
          <div><span className="cat-badge">{t.cat}</span></div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{t.data}</div>
          <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 500, color: t.tipo === 'entrada' ? 'var(--green)' : 'var(--red)' }}>
            {t.tipo === 'entrada' ? '+' : '-'}{fmt(t.valor)}
          </div>
          <div>
            <button className="del-btn" onClick={() => delTransaction(t.id)}>✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}
