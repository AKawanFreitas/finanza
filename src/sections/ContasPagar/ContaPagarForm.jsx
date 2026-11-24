import { useEffect, useState, useId } from 'react';
import { AlignLeft, Tag, Calendar, Wallet, MessageSquare, Plus, Check, X, CalendarCheck, CalendarClock, DollarSign, ArrowRight } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { api } from '../../utils/api';
import FormHeader from '../../components/FormHeader';
import Select from '../../components/Select';

const vazio = cats => ({ descricao: '', valor: '', vencimento: '', cat: cats[0]?.nome || '', conta_id: 0, obs: '' });

export default function ContaPagarForm({ editando, onCancelar, onSalvo }) {
  const uid = useId();
  const { categorias, contas, showToast } = useFinance();
  const [form, setForm] = useState(vazio(categorias));
  const [enviando, setEnviando] = useState(false);
  const set = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }));

  useEffect(() => {
    setForm(editando
      ? { descricao: editando.descricao, valor: String(editando.valor), vencimento: editando.vencimento, cat: editando.cat, conta_id: editando.conta_id ?? 0, obs: editando.obs || '' }
      : vazio(categorias));
  }, [editando, categorias]);

  const catOptions = categorias.map(c => ({ value: c.nome, label: c.nome, color: c.cor, icone: c.icone }));
  const contaOptions = [
    { value: 0, label: 'Escolher na hora de pagar' },
    ...contas.filter(c => !c.arquivada || c.id === form.conta_id).map(c => ({ value: c.id, label: c.nome, color: c.cor })),
  ];

  async function enviar() {
    if (!form.descricao.trim() || !form.valor || !form.vencimento) return;
    const corpo = {
      descricao: form.descricao.trim(), valor: Number(form.valor), vencimento: form.vencimento, cat: form.cat, obs: form.obs,
      ...(form.conta_id ? { conta_id: form.conta_id } : {}),
    };
    setEnviando(true);
    try {
      const { ok, data } = await api(editando ? `/contas-pagar/${editando.id}` : '/contas-pagar', { method: editando ? 'PUT' : 'POST', body: corpo });
      if (!ok) return showToast(data?.error || 'Não foi possível salvar.', 'err');
      showToast(editando ? 'Conta atualizada' : 'Conta adicionada');
      if (!editando) setForm(vazio(categorias));
      onSalvo();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={editando ? 'form-modal' : 'form-wrap'}>
      {!editando && <FormHeader Icon={CalendarCheck} titulo={editando ? 'Editar conta a pagar' : 'Nova conta a pagar'} subtitulo={editando ? 'Altere os dados e salve' : 'Boletos e contas com data de vencimento. Avisamos por e-mail antes de vencer'} />}
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label" htmlFor={`${uid}-1`}><AlignLeft size={16} />Descrição</label>
          <div className="form-input-wrap">
            <span className="form-prefix"><AlignLeft size={16} strokeWidth={2} /></span>
            <input id={`${uid}-1`} className="form-control" placeholder="Ex: Conta de luz" maxLength={120} value={form.descricao} onChange={e => set('descricao', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor={`${uid}-2`}><DollarSign size={16} />Valor</label>
          <div className="form-input-wrap has-text-prefix">
            <span className="form-prefix-text">R$</span>
            <input id={`${uid}-2`} className="form-control" type="number" min="0" step="0.01" placeholder="0,00" value={form.valor} onChange={e => set('valor', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor={`${uid}-3`}><CalendarClock size={16} />Vencimento</label>
          <div className="form-input-wrap">
            <span className="form-prefix"><Calendar size={16} strokeWidth={2} /></span>
            <input id={`${uid}-3`} className="form-control" type="date" value={form.vencimento} onChange={e => set('vencimento', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor={`${uid}-4`}><Tag size={16} />Categoria</label>
          <Select id={`${uid}-4`} value={form.cat} onChange={v => set('cat', v)} options={catOptions} prefix={<Tag size={14} strokeWidth={2} />} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor={`${uid}-5`}><Wallet size={16} />Conta de pagamento</label>
          <Select id={`${uid}-5`} value={form.conta_id} onChange={v => set('conta_id', v)} options={contaOptions} prefix={<Wallet size={14} strokeWidth={2} />} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor={`${uid}-6`}><MessageSquare size={16} />Observação <span className="form-label-opt">(opcional)</span></label>
          <div className="form-input-wrap">
            <span className="form-prefix"><MessageSquare size={16} strokeWidth={2} /></span>
            <input id={`${uid}-6`} className="form-control" placeholder="Ex: código de barras, referência" value={form.obs} onChange={e => set('obs', e.target.value)} />
          </div>
        </div>
      </div>
      <div className="form-actions">
        <button className="btn btn-primary btn-full" onClick={enviar} disabled={enviando}>
          {editando ? <Check size={15} strokeWidth={2.5} /> : <Plus size={15} strokeWidth={2.5} />}
          {editando ? 'Salvar alterações' : 'Adicionar conta'}
        <ArrowRight size={15} strokeWidth={2.5} />
        </button>
        {editando && <button className="btn btn-ghost" onClick={onCancelar}><X size={14} strokeWidth={2} /> Cancelar</button>}
      </div>
    </div>
  );
}
