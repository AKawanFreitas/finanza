import { Pencil, Trash2, CalendarClock, CalendarPlus, Check } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { fmt, fmtDate, dueDate, getCatColor } from '../../utils/formatters';

export default function RecorrenteList() {
  const {
    recorrentes, categorias, transactions, delRecorrente, editingRec, setEditingRec,
    addTransaction, showToast,
  } = useFinance();
  const total = recorrentes.reduce((a, r) => a + r.valor, 0);

  const month = dueDate(1).slice(0, 7);
  const isLaunched = r => transactions.some(t =>
    t.desc === r.nome && t.cat === r.cat && t.tipo === 'saida' && t.data.startsWith(month));
  const pending = recorrentes.filter(r => !isLaunched(r));

  const toTransaction = r => ({
    desc: r.nome, valor: r.valor, tipo: 'saida', cat: r.cat,
    data: dueDate(r.dia), obs: r.obs || '',
  });

  function launch(r) {
    addTransaction(toTransaction(r));
  }

  async function launchAll() {
    let done = 0;
    for (const r of pending) {
      if (await addTransaction(toTransaction(r), { silent: true })) done++;
    }
    if (done) showToast(`${done} ${done === 1 ? 'recorrente lançado' : 'recorrentes lançados'} ✓`);
  }

  return (
    <div className="hist-wrap">
      <div className="card-head" style={{ marginBottom: '1rem' }}>
        <div className="card-title">Recorrentes cadastrados</div>
        <div className="card-sub">Total: {fmt(total)}/mês</div>
      </div>

      {recorrentes.length > 0 && (
        <div className="launch-bar">
          <span>
            {pending.length === 0
              ? 'Todos os recorrentes deste mês já foram lançados.'
              : `${pending.length} ${pending.length === 1 ? 'pendente' : 'pendentes'} neste mês.`}
          </span>
          {pending.length > 0 && (
            <button className="btn" onClick={launchAll}>
              <CalendarPlus size={14} strokeWidth={2} />
              Lançar pendentes
            </button>
          )}
        </div>
      )}

      <div className="rec-grid">
        {recorrentes.length === 0 ? (
          <div className="empty">Nenhum recorrente cadastrado.</div>
        ) : recorrentes.map(r => {
          const color   = getCatColor(categorias, r.cat);
          return (
            <div key={r.id} className={`rec-card ${editingRec?.id === r.id ? 'editing' : ''}`}>
              <div className="rec-left">
                <span className="dot" style={{ background: color }} />
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
                {isLaunched(r) ? (
                  <span className="launched" title={`Lançado em ${fmtDate(dueDate(r.dia))}`}>
                    <Check size={13} strokeWidth={2.5} /> Lançado
                  </span>
                ) : (
                  <button className="btn btn-sm" onClick={() => launch(r)} title={`Lançar em ${fmtDate(dueDate(r.dia))}`}>
                    <CalendarPlus size={13} strokeWidth={2} />
                    Lançar
                  </button>
                )}
                <span className={`tag ${r.tipo === 'fixo' ? 'tag-fixo' : 'tag-rec'}`}>
                  {r.tipo === 'fixo' ? 'Fixo' : 'Variável'}
                </span>
                <div className="rec-amount">{fmt(r.valor)}</div>
                <div className="hist-actions">
                  <button className="del-btn" onClick={() => { setEditingRec(r); window.scrollTo({ top: 0, behavior: 'smooth' }); }} title="Editar">
                    <Pencil size={13} strokeWidth={2} />
                  </button>
                  <button className="del-btn" onClick={() => delRecorrente(r.id)} title="Excluir">
                    <Trash2 size={13} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
