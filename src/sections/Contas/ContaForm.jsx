import { useEffect, useRef, useState } from 'react';
import { Wallet, Palette, Plus, Check, X, Landmark } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import Select from '../../components/Select';
import { TIPOS_CONTA } from './tipos';

const PRESET_COLORS = ['#4d9fff', '#22a84a', '#e84057', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];
const VAZIO = { nome: '', tipo: 'corrente', saldo_inicial: '', cor: '#4d9fff' };

export default function ContaForm() {
  const { addConta, updateConta, editingConta, setEditingConta } = useFinance();
  const [form, setForm] = useState(VAZIO);
  const colorRef = useRef(null);
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
      <div className="form-header">
        <div className="form-header-text">
          <div className="form-header-title">{editingConta ? 'Editar conta' : 'Nova conta'}</div>
          <div className="form-header-sub">
            {editingConta ? 'Altere os dados e salve' : 'Cadastre um banco, carteira ou investimento'}
          </div>
        </div>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">Nome</label>
          <div className="form-input-wrap">
            <span className="form-prefix"><Wallet size={14} strokeWidth={2} /></span>
            <input
              className="form-control" placeholder="Ex: Nubank" value={form.nome} maxLength={40}
              onChange={e => set('nome', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && enviar()}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Tipo</label>
          <Select value={form.tipo} onChange={v => set('tipo', v)} options={TIPOS_CONTA} prefix={<Landmark size={14} strokeWidth={2} />} />
        </div>

        <div className="form-group">
          <label className="form-label">Saldo inicial</label>
          <div className="form-input-wrap has-text-prefix">
            <span className="form-prefix-text">R$</span>
            <input
              className="form-control" type="number" step="0.01" placeholder="0,00"
              value={form.saldo_inicial} onChange={e => set('saldo_inicial', e.target.value)}
            />
          </div>
        </div>

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
