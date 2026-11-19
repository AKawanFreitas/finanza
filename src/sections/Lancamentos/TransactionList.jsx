import { Pencil, Trash2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { fmt, getCatColor, catIcon } from '../../utils/formatters';

export default function TransactionList() {
  const { transactions, categorias, delTransaction, editing, setEditing } = useFinance();
  const sorted = [...transactions].sort((a, b) => b.id - a.id);

  return (
    <div className="hist-wrap">
      <div className="card-head" style={{ marginBottom: '0.75rem' }}>
        <div className="card-title">Histórico de lançamentos</div>
        <div className="card-sub">{sorted.length} {sorted.length === 1 ? 'registro' : 'registros'}</div>
      </div>

      <div className="hist-head">
        <div>Descrição</div>
        <div>Categoria</div>
        <div>Data</div>
        <div style={{ textAlign: 'right' }}>Valor</div>
        <div />
      </div>

      {sorted.length === 0 ? (
        <div className="empty">Nenhuma transação ainda.</div>
      ) : sorted.map(t => {
        const CatIcon = catIcon(t.cat);
        const color   = getCatColor(categorias, t.cat);
        const isIn    = t.tipo === 'entrada';
        return (
          <div key={t.id} className={`hist-row ${editing?.id === t.id ? 'editing' : ''}`}>
            <div className="hist-desc-wrap">
              <div className="hist-mini-icon" style={{ background: color + '18', color }}>
                <CatIcon size={13} strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{t.desc}</div>
                {t.obs && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{t.obs}</div>}
              </div>
            </div>
            <div><span className="cat-badge">{t.cat}</span></div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{t.data}</div>
            <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
              {isIn
                ? <ArrowDownLeft size={13} color="var(--green)" strokeWidth={2.5} />
                : <ArrowUpRight  size={13} color="var(--red)"   strokeWidth={2.5} />
              }
              <span style={{ fontSize: 13, fontWeight: 600, color: isIn ? 'var(--green)' : 'var(--red)' }}>
                {isIn ? '+' : '-'}{fmt(t.valor)}
              </span>
            </div>
            <div className="hist-actions">
              <button className="del-btn" onClick={() => { setEditing(t); window.scrollTo({ top: 0, behavior: 'smooth' }); }} title="Editar">
                <Pencil size={13} strokeWidth={2} />
              </button>
              <button className="del-btn" onClick={() => delTransaction(t.id)} title="Excluir">
                <Trash2 size={13} strokeWidth={2} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
