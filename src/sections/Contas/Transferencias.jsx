import { useEffect, useState } from 'react';
import { ArrowRight, ArrowLeftRight, Calendar, AlignLeft, Trash2 } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { api } from '../../utils/api';
import { fmt, fmtDate, today } from '../../utils/formatters';
import Select from '../../components/Select';

// origem_id e destino_id ficam nulos até a pessoa escolher; o padrão é calculado a cada render,
// porque as contas podem mudar (criar uma nova) depois que o formulário já foi montado.
const VAZIO = () => ({ origem_id: null, destino_id: null, valor: '', data: today(), descricao: '' });

export default function Transferencias() {
  const { contas, versao, addTransferencia, delTransferencia } = useFinance();
  const ativas = contas.filter(c => !c.arquivada);
  const [form, setForm] = useState(VAZIO);
  const [lista, setLista] = useState([]);
  const set = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }));

  useEffect(() => {
    let cancelado = false;
    api('/transferencias?limite=10').then(({ ok, data }) => { if (ok && !cancelado) setLista(data); });
    return () => { cancelado = true; };
  }, [versao]);

  const opcoes = ativas.map(c => ({ value: c.id, label: c.nome, color: c.cor }));
  const origem  = ativas.some(c => c.id === form.origem_id)  ? form.origem_id  : ativas[0]?.id;
  const destino = ativas.some(c => c.id === form.destino_id) && form.destino_id !== origem
    ? form.destino_id
    : ativas.find(c => c.id !== origem)?.id;

  async function enviar() {
    if (!form.valor) return;
    const ok = await addTransferencia({ ...form, origem_id: origem, destino_id: destino, valor: Number(form.valor) });
    if (ok) setForm(VAZIO());
  }

  if (ativas.length < 2) {
    return (
      <div className="hist-wrap">
        <div className="card-head"><div className="card-title">Transferências</div></div>
        <div className="empty">Crie ao menos duas contas ativas para transferir valores entre elas.</div>
      </div>
    );
  }

  return (
    <>
      <div className="form-wrap">
        <div className="form-header">
          <div className="form-header-text">
            <div className="form-header-title">Transferir entre contas</div>
            <div className="form-header-sub">Move o saldo sem contar como receita nem gasto</div>
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">De</label>
            <Select value={origem} onChange={v => set('origem_id', v)} options={opcoes} />
          </div>
          <div className="form-group">
            <label className="form-label">Para</label>
            <Select value={destino} onChange={v => set('destino_id', v)} options={opcoes} />
          </div>
          <div className="form-group">
            <label className="form-label">Valor</label>
            <div className="form-input-wrap has-text-prefix">
              <span className="form-prefix-text">R$</span>
              <input className="form-control" type="number" min="0" step="0.01" placeholder="0,00"
                value={form.valor} onChange={e => set('valor', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Data</label>
            <div className="form-input-wrap">
              <span className="form-prefix"><Calendar size={14} strokeWidth={2} /></span>
              <input className="form-control" type="date" value={form.data} onChange={e => set('data', e.target.value)} />
            </div>
          </div>
          <div className="form-group form-span-2">
            <label className="form-label">Descrição <span className="form-label-opt">(opcional)</span></label>
            <div className="form-input-wrap">
              <span className="form-prefix"><AlignLeft size={14} strokeWidth={2} /></span>
              <input className="form-control" placeholder="Ex: Reserva do mês" value={form.descricao} maxLength={120}
                onChange={e => set('descricao', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button className="btn btn-primary btn-full" onClick={enviar}>
            <ArrowLeftRight size={15} strokeWidth={2.5} /> Transferir
          </button>
        </div>
      </div>

      {lista.length > 0 && (
        <div className="hist-wrap">
          <div className="card-head"><div className="card-title">Últimas transferências</div></div>
          <div className="rec-grid">
            {lista.map(t => (
              <div key={t.id} className="rec-card">
                <div className="rec-left">
                  <div>
                    <div className="rec-name-text transf-rota">
                      {t.origem} <ArrowRight size={13} strokeWidth={2.5} /> {t.destino}
                    </div>
                    <div className="rec-detail-text">{fmtDate(t.data)}{t.descricao ? ` · ${t.descricao}` : ''}</div>
                  </div>
                </div>
                <div className="rec-right">
                  <div className="rec-amount">{fmt(t.valor)}</div>
                  <div className="hist-actions">
                    <button className="del-btn" title="Excluir" onClick={() => delTransferencia(t.id)}>
                      <Trash2 size={13} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
