import { Trash2, CalendarClock } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { fmt, catIcon, getCatColor } from '../../utils/formatters';

export default function RecorrenteList() {
  const { recorrentes, categorias, delRecorrente } = useFinance();
  const total = recorrentes.reduce((a, r) => a + r.valor, 0);

  return (
    <div className="hist-wrap">
      <div className="card-head" style={{ marginBottom: '1rem' }}>
        <div className="card-title">Recorrentes cadastrados</div>
        <div className="card-sub">Total: {fmt(total)}/mês</div>
      </div>

      <div className="rec-grid">
        {recorrentes.length === 0 ? (
          <div className="empty">Nenhum recorrente cadastrado.</div>
        ) : recorrentes.map(r => {
          const CatIcon = catIcon(r.cat);
          const color   = getCatColor(categorias, r.cat);
          return (
            <div key={r.id} className="rec-card">
              <div className="rec-left">
                <div className="rec-icon" style={{ background: color + '18', color }}>
                  <CatIcon size={16} strokeWidth={2} />
                </div>
                <div>
                  <div className="rec-name-text">{r.nome}</div>
                  <div className="rec-detail-text" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CalendarClock size={11} strokeWidth={2} />
                    vence dia {r.dia}
                    {r.obs ? ` · ${r.obs}` : ''}
                  </div>
                </div>
              </div>
              <div className="rec-right">
                <span className={`tag ${r.tipo === 'fixo' ? 'tag-fixo' : 'tag-rec'}`}>
                  {r.tipo === 'fixo' ? 'Fixo' : 'Variável'}
                </span>
                <div className="rec-amount">{fmt(r.valor)}</div>
                <button className="del-btn" onClick={() => delRecorrente(r.id)} title="Excluir">
                  <Trash2 size={13} strokeWidth={2} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
