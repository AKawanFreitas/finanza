import { useEffect, useState, useId } from 'react';
import { PiggyBank, Calendar, Plus, Check, X, Type, DollarSign, Wallet, Info, ArrowRight } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { api } from '../../utils/api';
import FormHeader from '../../components/FormHeader';
import { lerValor, valorParaCampo } from '../../utils/valor';

const VAZIO = { nome: '', valor_alvo: '', prazo: '', valor_inicial: '', cor: '#22a84a' };

export default function MetaForm({ editando, onCancelar, onSalvo }) {
  const uid = useId();
  const { showToast } = useFinance();
  const [form, setForm] = useState(VAZIO);
  const [enviando, setEnviando] = useState(false);
  const set = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }));

  useEffect(() => {
    setForm(editando
      ? { nome: editando.nome, valor_alvo: valorParaCampo(editando.valor_alvo), prazo: editando.prazo ?? '', valor_inicial: '', cor: editando.cor }
      : VAZIO);
  }, [editando]);

  async function enviar() {
    if (!form.nome.trim() || !form.valor_alvo) return;
    const corpo = {
      nome: form.nome.trim(), valor_alvo: lerValor(form.valor_alvo), prazo: form.prazo || null, cor: form.cor,
      ...(editando ? { arquivada: editando.arquivada } : form.valor_inicial ? { valor_inicial: lerValor(form.valor_inicial) } : {}),
    };
    setEnviando(true);
    try {
      const { ok, data } = await api(editando ? `/metas/${editando.id}` : '/metas', { method: editando ? 'PUT' : 'POST', body: corpo });
      if (!ok) return showToast(data?.error || 'Não foi possível salvar a meta.', 'err');
      showToast(editando ? 'Meta atualizada' : 'Meta criada');
      if (!editando) setForm(VAZIO);
      onSalvo();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={editando ? 'form-modal' : 'form-wrap'}>
      {!editando && <FormHeader
        Icon={PiggyBank}
        titulo={editando ? 'Editar meta' : 'Nova meta'}
        subtitulo={editando ? 'Altere os dados e salve' : 'Reserva de emergência, viagem, entrada do carro... guarde aos poucos'}
      />}
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label" htmlFor={`${uid}-1`}><Type size={16} />Nome</label>
          <div className="form-input-wrap">
            <span className="form-prefix"><PiggyBank size={16} strokeWidth={2} /></span>
            <input id={`${uid}-1`} className="form-control" placeholder="Ex: Reserva de emergência" maxLength={60} value={form.nome} onChange={e => set('nome', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor={`${uid}-2`}><DollarSign size={16} />Valor da meta</label>
          <div className="form-input-wrap has-text-prefix">
            <span className="form-prefix-text">R$</span>
            <input id={`${uid}-2`} className="form-control" type="text" inputMode="decimal" autoComplete="off" placeholder="0,00" value={form.valor_alvo} onChange={e => set('valor_alvo', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor={`${uid}-3`}><Calendar size={16} />Prazo <span className="form-label-opt">(opcional)</span></label>
          <div className="form-input-wrap">
            <span className="form-prefix"><Calendar size={16} strokeWidth={2} /></span>
            <input id={`${uid}-3`} className="form-control" type="date" value={form.prazo} onChange={e => set('prazo', e.target.value)} />
          </div>
          <span className="form-dica"><Info size={14} />Com prazo, mostramos quanto guardar por mês.</span>
        </div>
        {!editando && (
          <div className="form-group">
            <label className="form-label" htmlFor={`${uid}-4`}><Wallet size={16} />Já guardado <span className="form-label-opt">(opcional)</span></label>
            <div className="form-input-wrap has-text-prefix">
              <span className="form-prefix-text">R$</span>
              <input id={`${uid}-4`} className="form-control" type="text" inputMode="decimal" autoComplete="off" placeholder="0,00" value={form.valor_inicial} onChange={e => set('valor_inicial', e.target.value)} />
            </div>
          </div>
        )}
      </div>
      <div className="form-actions">
        <button className="btn btn-primary btn-full" onClick={enviar} disabled={enviando}>
          {editando ? <Check size={15} strokeWidth={2.5} /> : <Plus size={15} strokeWidth={2.5} />}
          {editando ? 'Salvar alterações' : 'Criar meta'}
          <ArrowRight size={15} strokeWidth={2.5} />
        </button>
        {editando && <button className="btn btn-ghost" onClick={onCancelar}><X size={14} strokeWidth={2} /> Cancelar</button>}
      </div>
    </div>
  );
}
