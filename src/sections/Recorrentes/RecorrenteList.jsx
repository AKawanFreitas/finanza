import { useFinance } from '../../context/FinanceContext';
import { fmt } from '../../utils/formatters';

export default function RecorrenteList() {
  const { recorrentes, delRecorrente } = useFinance();
  const total = recorrentes.reduce((a, r) => a + r.valor, 0);

  return (
    <div className="hist-wrap">
      <div className="card-head" style={{ marginBottom: '1rem' }}>
        <div className="card-title">Todos os recorrentes</div>
        <div className="card-sub">Total: {fmt(total)}/mês</div>
      </div>
      <div className="rec-grid">
        {recorrentes.length === 0 ? (
          <div className="empty">Nenhum recorrente cadastrado.</div>
        ) : recorrentes.map(r => (
          <div key={r.id} className="rec-card">
            <div>
              <div className="rec-name-text">{r.nome}</div>
              <div className="rec-detail-text">
                {r.cat} · vence dia {r.dia}{r.obs ? ` · ${r.obs}` : ''}
              </div>
            </div>
            <div className="rec-right">
              <span className={`tag ${r.tipo === 'fixo' ? 'tag-fixo' : 'tag-rec'}`}>
                {r.tipo === 'fixo' ? 'Fixo' : 'Recorrente'}
              </span>
              <div className="rec-amount">{fmt(r.valor)}</div>
              <button className="del-btn" onClick={() => delRecorrente(r.id)}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
