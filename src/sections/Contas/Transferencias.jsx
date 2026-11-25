import { useEffect, useState, useId } from 'react';
import { ArrowRight, ArrowLeftRight, Calendar, AlignLeft, Trash2, History, ArrowUpRight, ArrowDownLeft, DollarSign } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { api } from '../../utils/api';
import { fmt, fmtDate, today } from '../../utils/formatters';
import FormHeader from '../../components/FormHeader';
import Select from '../../components/Select';
import IconButton from '../../components/IconButton';
import { useConfirm } from '../../components/Confirm';
import { lerValor } from '../../utils/valor';
import useEnvioUnico from '../../utils/useEnvioUnico';

// origem_id e destino_id ficam nulos até a pessoa escolher; o padrão é calculado a cada render,
// porque as contas podem mudar (criar uma nova) depois que o formulário já foi montado.
const VAZIO = () => ({ origem_id: null, destino_id: null, valor: '', data: today(), descricao: '' });

export default function Transferencias() {
  const uid = useId();
  const { contas, versao, addTransferencia, delTransferencia } = useFinance();
  const confirmar = useConfirm();
  const excluir = async t => {
    if (await confirmar({ titulo: 'Excluir transferência?', mensagem: `${t.origem} → ${t.destino}. Os saldos das duas contas voltam ao que eram antes.`, rotulo: 'Excluir' })) delTransferencia(t.id);
  };
  // Pagar fatura de cartão é feito na tela de Cartões; aqui só entre contas comuns.
  const ativas = contas.filter(c => !c.arquivada && c.tipo !== 'cartao');
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
    const ok = await addTransferencia({ ...form, origem_id: origem, destino_id: destino, valor: lerValor(form.valor) });
    if (ok) setForm(VAZIO());
  }
  const [enviarUmaVez, enviando] = useEnvioUnico(enviar);

  if (ativas.length < 2) {
    return (
      <div className="hist-wrap">
        <div className="card-head"><div className="card-title"><ArrowLeftRight size={20} />Transferências</div></div>
        <div className="empty">Crie ao menos duas contas ativas para transferir valores entre elas.</div>
      </div>
    );
  }

  return (
    <>
      <div className="form-wrap">
        <FormHeader Icon={ArrowLeftRight} titulo={'Transferir entre contas'} subtitulo={'Move o saldo sem contar como receita nem gasto'} />

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label" htmlFor={`${uid}-1`}><ArrowUpRight size={16} />De</label>
            <Select id={`${uid}-1`} value={origem} onChange={v => set('origem_id', v)} options={opcoes} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={`${uid}-2`}><ArrowDownLeft size={16} />Para</label>
            <Select id={`${uid}-2`} value={destino} onChange={v => set('destino_id', v)} options={opcoes} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={`${uid}-3`}><DollarSign size={16} />Valor</label>
            <div className="form-input-wrap has-text-prefix">
              <span className="form-prefix-text">R$</span>
              <input id={`${uid}-3`} className="form-control" type="text" inputMode="decimal" autoComplete="off" placeholder="0,00"
                value={form.valor} onChange={e => set('valor', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={`${uid}-4`}><Calendar size={16} />Data</label>
            <div className="form-input-wrap">
              <span className="form-prefix"><Calendar size={16} strokeWidth={2} /></span>
              <input id={`${uid}-4`} className="form-control" type="date" value={form.data} onChange={e => set('data', e.target.value)} />
            </div>
          </div>
          <div className="form-group form-span-2">
            <label className="form-label" htmlFor={`${uid}-5`}><AlignLeft size={16} />Descrição <span className="form-label-opt">(opcional)</span></label>
            <div className="form-input-wrap">
              <span className="form-prefix"><AlignLeft size={16} strokeWidth={2} /></span>
              <input id={`${uid}-5`} className="form-control" placeholder="Ex: Reserva do mês" value={form.descricao} maxLength={120}
                onChange={e => set('descricao', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button className="btn btn-primary btn-full" onClick={enviarUmaVez} disabled={enviando}>
            <ArrowLeftRight size={15} strokeWidth={2.5} /> Transferir
          <ArrowRight size={15} strokeWidth={2.5} />
        </button>
        </div>
      </div>

      {lista.length > 0 && (
        <div className="hist-wrap">
          <div className="card-head"><div className="card-title"><History size={20} />Últimas transferências</div></div>
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
                    <IconButton label="Excluir" danger onClick={() => excluir(t)}>
                      <Trash2 size={13} strokeWidth={2} />
                    </IconButton>
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
