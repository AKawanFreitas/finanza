import { useEffect, useState } from 'react';
import { AlignLeft, Tag, Calendar, Wallet, MessageSquare, Plus, Check, X } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { api } from '../../utils/api';
import Select from '../../components/Select';

const vazio = cats => ({ descricao: '', valor: '', vencimento: '', cat: cats[0]?.nome || '', conta_id: 0, obs: '' });

export default function ContaPagarForm({ editando, onCancelar, onSalvo }) {
  const { categorias, contas, showToast } = useFinance();
  const [form, setForm] = useState(vazio(categorias));
  const [enviando, setEnviando] = useState(false);
  const set = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }));

  useEffect(() => {
    setForm(editando
      ? { descricao: editando.descricao, valor: String(editando.valor), vencimento: editando.vencimento, cat: editando.cat, conta_id: editando.conta_id ?? 0, obs: editando.obs || '' }
      : vazio(categorias));
  }, [editando, categorias]);

  const catOptions = categorias.map(c => ({ value: c.nome, label: c.nome, color: c.cor }));
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
      showToast(editando ? 'Conta atualizada ✓' : 'Conta adicionada ✓');
      if (!editando) setForm(vazio(categorias));
      onSalvo();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="form-wrap">
      <div className="form-header">
        <div className="form-header-text">
          <div className="form-header-title">{editando ? 'Editar conta a pagar' : 'Nova conta a pagar'}</div>
          <div className="form-header-sub">{editando ? 'Altere os dados e salve' : 'Boletos e contas com data de vencimento. Avisamos por e-mail antes de vencer'}</div>
        </div>
      </div>
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">Descrição</label>
          <div className="form-input-wrap">
            <span className="form-prefix"><AlignLeft size={14} strokeWidth={2} /></span>
            <input className="form-control" placeholder="Ex: Conta de luz" maxLength={120} value={form.descricao} onChange={e => set('descricao', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Valor</label>
          <div className="form-input-wrap has-text-prefix">
            <span className="form-prefix-text">R$</span>
            <input className="form-control" type="number" min="0" step="0.01" placeholder="0,00" value={form.valor} onChange={e => set('valor', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Vencimento</label>
          <div className="form-input-wrap">
            <span className="form-prefix"><Calendar size={14} strokeWidth={2} /></span>
            <input className="form-control" type="date" value={form.vencimento} onChange={e => set('vencimento', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Categoria</label>
          <Select value={form.cat} onChange={v => set('cat', v)} options={catOptions} prefix={<Tag size={14} strokeWidth={2} />} />
        </div>
        <div className="form-group">
          <label className="form-label">Conta de pagamento</label>
          <Select value={form.conta_id} onChange={v => set('conta_id', v)} options={contaOptions} prefix={<Wallet size={14} strokeWidth={2} />} />
        </div>
        <div className="form-group">
          <label className="form-label">Observação <span className="form-label-opt">(opcional)</span></label>
          <div className="form-input-wrap">
            <span className="form-prefix"><MessageSquare size={14} strokeWidth={2} /></span>
            <input className="form-control" placeholder="Ex: código de barras, referência" value={form.obs} onChange={e => set('obs', e.target.value)} />
          </div>
        </div>
      </div>
      <div className="form-actions">
        <button className="btn btn-primary btn-full" onClick={enviar} disabled={enviando}>
          {editando ? <Check size={15} strokeWidth={2.5} /> : <Plus size={15} strokeWidth={2.5} />}
          {editando ? 'Salvar alterações' : 'Adicionar conta'}
        </button>
        {editando && <button className="btn btn-ghost" onClick={onCancelar}><X size={14} strokeWidth={2} /> Cancelar</button>}
      </div>
    </div>
  );
}
