import { useEffect, useState, useId } from 'react';
import { Wallet, Palette, Plus, Check, X, Landmark, Type, DollarSign, ArrowRight } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import FormHeader from '../../components/FormHeader';
import Select from '../../components/Select';
import { TIPOS_CONTA } from './tipos';

const PRESET_COLORS = ['#4d9fff', '#22a84a', '#e84057', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];
const VAZIO = { nome: '', tipo: 'corrente', saldo_inicial: '', cor: '#4d9fff' };

export default function ContaForm() {
  const uid = useId();
  const { addConta, updateConta, editingConta, setEditingConta } = useFinance();
  const [form, setForm] = useState(VAZIO);
  const set = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }));

  useEffect(() => {
    setForm(editingConta
      ? { nome: editingConta.nome, tipo: editingConta.tipo, cor: editingConta.cor, saldo_inicial: String(editingConta.saldo_inicial) }
      : VAZIO);
  }, [editingConta]);

  async function enviar() {
    if (!form.nome.trim()) return;
    const dados = {
      nome: form.nome.trim(), tipo: form.tipo, cor: form.cor,
      saldo_inicial: form.saldo_inicial === '' ? 0 : Number(form.saldo_inicial),
    };
    const ok = editingConta
      ? await updateConta(editingConta.id, { ...dados, arquivada: editingConta.arquivada })
      : await addConta(dados);
    if (!ok) return;
    if (editingConta) setEditingConta(null);
    else setForm(VAZIO);
  }

  return (
    <div className="form-wrap">
      <FormHeader Icon={Wallet} titulo={editingConta ? 'Editar conta' : 'Nova conta'} subtitulo={editingConta ? 'Altere os dados e salve' : 'Cadastre um banco, carteira ou investimento'} />

      <div className="form-grid">
        <div className="form-group">
          <label className="form-label" htmlFor={`${uid}-1`}><Type size={16} />Nome</label>
          <div className="form-input-wrap">
            <span className="form-prefix"><Wallet size={16} strokeWidth={2} /></span>
            <input id={`${uid}-1`}
              className="form-control" placeholder="Ex: Nubank" value={form.nome} maxLength={40}
              onChange={e => set('nome', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && enviar()}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor={`${uid}-2`}><Landmark size={16} />Tipo</label>
          <Select id={`${uid}-2`} value={form.tipo} onChange={v => set('tipo', v)} options={TIPOS_CONTA} prefix={<Landmark size={14} strokeWidth={2} />} />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor={`${uid}-3`}><DollarSign size={16} />Saldo inicial</label>
          <div className="form-input-wrap has-text-prefix">
            <span className="form-prefix-text">R$</span>
            <input id={`${uid}-3`}
              className="form-control" type="number" step="0.01" placeholder="0,00"
              value={form.saldo_inicial} onChange={e => set('saldo_inicial', e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor={`${uid}-4`}><Palette size={16} />Cor</label>
          <label className="color-pick-wrap" htmlFor={`${uid}-4`}>
            <div className="color-swatch" style={{ background: form.cor }} />
            <span className="color-swatch-label">{form.cor.toUpperCase()}</span>
            <Palette size={14} strokeWidth={2} style={{ color: 'var(--faint)' }} />
            <input id={`${uid}-4`} type="color" value={form.cor} onChange={e => set('cor', e.target.value)} />
          </label>
        </div>
      </div>

      <div className="color-presets">
        {PRESET_COLORS.map(c => (
          <button
            key={c} type="button" title={c}
            className={`color-preset-dot ${form.cor === c ? 'selected' : ''}`}
            style={{ background: c }} onClick={() => set('cor', c)}
          />
        ))}
      </div>

      <div className="form-actions" style={{ marginTop: '1.1rem' }}>
        <button className="btn btn-primary btn-full" onClick={enviar}>
          {editingConta ? <Check size={15} strokeWidth={2.5} /> : <Plus size={15} strokeWidth={2.5} />}
          {editingConta ? 'Salvar alterações' : 'Criar conta'}
        <ArrowRight size={15} strokeWidth={2.5} />
        </button>
        {editingConta && (
          <button className="btn btn-ghost" onClick={() => setEditingConta(null)}>
            <X size={14} strokeWidth={2} /> Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
