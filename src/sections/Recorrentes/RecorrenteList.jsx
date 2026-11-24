import { Pencil, Trash2, CalendarClock, CalendarPlus, Check, Zap, Repeat, Info } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { fmt, fmtDate, dueDate, getCatColor } from '../../utils/formatters';
import IconButton from '../../components/IconButton';
import { useConfirm } from '../../components/Confirm';

export default function RecorrenteList() {
  const {
    recorrentes, categorias, delRecorrente, editingRec, setEditingRec,
    lancarRecorrente, lancarPendentes,
  } = useFinance();
  const confirmar = useConfirm();
  const excluir = async r => {
    if (await confirmar({ titulo: `Excluir “${r.nome}”?`, mensagem: 'Os lançamentos que ele já gerou continuam no histórico. Esta ação não pode ser desfeita.', rotulo: 'Excluir' })) delRecorrente(r.id);
  };
  const total = recorrentes.reduce((a, r) => a + r.valor, 0);

  // `lancado` vem do servidor: o recorrente já gerou um lançamento neste mês.
  const pending = recorrentes.filter(r => !r.lancado);

  return (
    <div className="hist-wrap">
      <div className="card-head">
        <div className="card-title"><Repeat size={20} />Recorrentes cadastrados</div>
        <div className="card-sub pill">Total: {fmt(total)}/mês</div>
      </div>

      {recorrentes.length > 0 && (
        <div className="launch-bar">
          <span>
            {pending.length === 0
              ? 'Todos os recorrentes deste mês já foram lançados.'
              : `${pending.length} ${pending.length === 1 ? 'pendente' : 'pendentes'} neste mês.`}
          </span>
          {pending.length > 0 && (
            <button className="btn" onClick={lancarPendentes}>
              <CalendarPlus size={14} strokeWidth={2} />
              Lançar pendentes
            </button>
          )}
        </div>
      )}

      <div className="rec-grid">
        {recorrentes.length === 0 ? (
          <div className="empty form-dica"><Info size={14} />Nenhum recorrente cadastrado.</div>
        ) : recorrentes.map(r => {
          const color   = getCatColor(categorias, r.cat);
          return (
            <div key={r.id} className={`rec-card ${editingRec?.id === r.id ? 'editing' : ''}`}>
              <div className="rec-left">
                <span className="rec-icone" style={{ '--cor': color }} aria-hidden="true">
                  {r.tipo === 'fixo' ? <Zap size={18} /> : <Repeat size={18} />}
                </span>
                <div>
                  <div className="rec-name-text">{r.nome}</div>
                  <div className="rec-detail-text" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CalendarClock size={11} strokeWidth={2} />
                    vence dia {r.dia}
                    {r.obs ? ` · ${r.obs}` : ''}
                    {r.automatico && <span className="tag-auto" title="Lançado sozinho no vencimento"><Zap size={10} strokeWidth={2.5} /> automático</span>}
                  </div>
                </div>
              </div>
              <div className="rec-right">
                {r.lancado ? (
                  <span className="launched" title={`Lançado em ${fmtDate(dueDate(r.dia))}`}>
                    <Check size={13} strokeWidth={2.5} /> Lançado
                  </span>
                ) : (
                  <button className="btn btn-sm" onClick={() => lancarRecorrente(r.id)} title={`Lançar em ${fmtDate(dueDate(r.dia))}`}>
                    <CalendarPlus size={13} strokeWidth={2} />
                    Lançar
                  </button>
                )}
                <span className={`tag ${r.tipo === 'fixo' ? 'tag-fixo' : 'tag-rec'}`}>
                  {r.tipo === 'fixo' ? 'Fixo' : 'Variável'}
                </span>
                <div className="rec-amount">{fmt(r.valor)}</div>
                <div className="hist-actions">
                  <IconButton label="Editar" onClick={() => setEditingRec(r)}>
                    <Pencil size={13} strokeWidth={2} />
                  </IconButton>
                  <IconButton label="Excluir" danger onClick={() => excluir(r)}>
                    <Trash2 size={13} strokeWidth={2} />
                  </IconButton>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
