import { useEffect, useRef, useState } from 'react';
import { CreditCard, Palette, Plus, Check, X, CalendarClock, Wallet } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { api } from '../../utils/api';
import Select from '../../components/Select';

const CORES = ['#7c3aed', '#2563eb', '#e84057', '#d97706', '#22a84a', '#0891b2', '#db2777', '#14233a'];
const VAZIO = { nome: '', limite: '', dia_fechamento: '', dia_vencimento: '', cor: '#7c3aed', conta_pagamento_id: 0, divida_inicial: '' };

export default function CartaoForm({ editando, onCancelar, onSalvo }) {
  const { contas, showToast } = useFinance();
  const [form, setForm] = useState(VAZIO);
  const [enviando, setEnviando] = useState(false);
  const colorRef = useRef(null);
  const set = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }));

  useEffect(() => {
    setForm(editando
      ? {
        nome: editando.nome, limite: String(editando.limite), cor: editando.cor,
        dia_fechamento: String(editando.dia_fechamento), dia_vencimento: String(editando.dia_vencimento),
        conta_pagamento_id: editando.conta_pagamento_id ?? 0, divida_inicial: '',
      }
      : VAZIO);
  }, [editando]);

  const contasDePagamento = [
    { value: 0, label: 'Escolher na hora de pagar' },
    ...contas.filter(c => !c.arquivada && c.tipo !== 'cartao').map(c => ({ value: c.id, label: c.nome, color: c.cor })),
  ];

  async function enviar() {
    if (!form.nome.trim() || !form.limite || !form.dia_fechamento || !form.dia_vencimento) return;
    const corpo = {
      nome: form.nome.trim(), limite: Number(form.limite), cor: form.cor,
      dia_fechamento: Number(form.dia_fechamento), dia_vencimento: Number(form.dia_vencimento),
      conta_pagamento_id: form.conta_pagamento_id || null,
      ...(editando ? { arquivada: editando.arquivada } : { divida_inicial: form.divida_inicial === '' ? 0 : Number(form.divida_inicial) }),
    };
    setEnviando(true);
    try {
      const { ok, data } = await api(editando ? `/cartoes/${editando.id}` : '/cartoes', { method: editando ? 'PUT' : 'POST', body: corpo });
      if (!ok) return showToast(data?.error || 'Não foi possível salvar o cartão.', 'err');
      showToast(editando ? 'Cartão atualizado ✓' : 'Cartão criado ✓');
      if (!editando) setForm(VAZIO);
      onSalvo(data);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="form-wrap">
      <div className="form-header">
        <div className="form-header-text">
          <div className="form-header-title">{editando ? 'Editar cartão' : 'Novo cartão de crédito'}</div>
          <div className="form-header-sub">
            {editando
              ? 'Mudar o dia de fechamento reorganiza as faturas do cartão'
              : 'Informe o limite e os dias de fechamento e vencimento da fatura'}
          </div>
        </div>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">Nome</label>
          <div className="form-input-wrap">
            <span className="form-prefix"><CreditCard size={14} strokeWidth={2} /></span>
            <input className="form-control" placeholder="Ex: Nubank" maxLength={40} value={form.nome} onChange={e => set('nome', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Limite</label>
          <div className="form-input-wrap has-text-prefix">
            <span className="form-prefix-text">R$</span>
            <input className="form-control" type="number" min="0" step="0.01" placeholder="0,00" value={form.limite} onChange={e => set('limite', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Dia do fechamento</label>
          <div className="form-input-wrap">
            <span className="form-prefix"><CalendarClock size={14} strokeWidth={2} /></span>
            <input className="form-control" type="number" min="1" max="31" placeholder="Ex: 10" value={form.dia_fechamento} onChange={e => set('dia_fechamento', e.target.value)} />
          </div>
          <span className="form-dica">Compras até esse dia entram na fatura do mês; depois, na seguinte.</span>
        </div>

        <div className="form-group">
          <label className="form-label">Dia do vencimento</label>
          <div className="form-input-wrap">
            <span className="form-prefix"><CalendarClock size={14} strokeWidth={2} /></span>
            <input className="form-control" type="number" min="1" max="31" placeholder="Ex: 17" value={form.dia_vencimento} onChange={e => set('dia_vencimento', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Conta que costuma pagar a fatura</label>
          <Select value={form.conta_pagamento_id} onChange={v => set('conta_pagamento_id', v)} options={contasDePagamento} prefix={<Wallet size={14} strokeWidth={2} />} />
        </div>

        {!editando && (
          <div className="form-group">
            <label className="form-label">Dívida atual <span className="form-label-opt">(opcional)</span></label>
            <div className="form-input-wrap has-text-prefix">
              <span className="form-prefix-text">R$</span>
              <input className="form-control" type="number" min="0" step="0.01" placeholder="0,00" value={form.divida_inicial} onChange={e => set('divida_inicial', e.target.value)} />
            </div>
            <span className="form-dica">Quanto já está usado do limite hoje.</span>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Cor</label>
          <div className="color-pick-wrap" onClick={() => colorRef.current?.click()}>
            <div className="color-swatch" style={{ background: form.cor }} />
            <span className="color-swatch-label">{form.cor.toUpperCase()}</span>
            <Palette size={14} strokeWidth={2} style={{ color: 'var(--faint)' }} />
            <input ref={colorRef} type="color" value={form.cor} onChange={e => set('cor', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="color-presets">
        {CORES.map(c => (
          <button key={c} type="button" title={c} className={`color-preset-dot ${form.cor === c ? 'selected' : ''}`} style={{ background: c }} onClick={() => set('cor', c)} />
        ))}
      </div>

      <div className="form-actions" style={{ marginTop: '1.1rem' }}>
        <button className="btn btn-primary btn-full" onClick={enviar} disabled={enviando}>
          {editando ? <Check size={15} strokeWidth={2.5} /> : <Plus size={15} strokeWidth={2.5} />}
          {editando ? 'Salvar alterações' : 'Criar cartão'}
        </button>
        {editando && <button className="btn btn-ghost" onClick={onCancelar}><X size={14} strokeWidth={2} /> Cancelar</button>}
      </div>
    </div>
  );
}
