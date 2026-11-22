import { useEffect, useState, useId } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { Tag, Palette, Plus, Check, X } from 'lucide-react';

const PRESET_COLORS = [
  '#22a84a', '#2563eb', '#e84057', '#d97706',
  '#7c3aed', '#0891b2', '#db2777', '#65a30d',
];

export default function CategoriaForm() {
  const uid = useId();
  const { addCategoria, updateCategoria, editingCat, setEditingCat } = useFinance();
  const [nome, setNome] = useState('');
  const [cor, setCor]   = useState('#22a84a');

  useEffect(() => {
    setNome(editingCat?.nome ?? '');
    setCor(editingCat?.cor ?? '#22a84a');
  }, [editingCat]);

  async function handleSubmit() {
    if (!nome.trim()) return;
    const data = { nome: nome.trim(), cor };
    const ok = editingCat ? await updateCategoria(editingCat.id, data) : await addCategoria(data);
    if (!ok) return;
    if (editingCat) setEditingCat(null);
    else setNome('');
  }

  return (
    <div className="form-wrap">
      <div className="form-header">
        <div className="form-header-text">
          <div className="form-header-title">{editingCat ? 'Editar categoria' : 'Nova categoria'}</div>
          <div className="form-header-sub">
            {editingCat
              ? 'Renomear atualiza também os lançamentos e recorrentes dessa categoria'
              : 'Crie categorias personalizadas para organizar seus gastos'}
          </div>
        </div>
      </div>

      <div className="form-grid">

        <div className="form-group">
          <label className="form-label" htmlFor={`${uid}-1`}>Nome</label>
          <div className="form-input-wrap">
            <span className="form-prefix"><Tag size={14} strokeWidth={2} /></span>
            <input id={`${uid}-1`}
              className="form-control"
              placeholder="Ex: Lazer"
              value={nome}
              onChange={e => setNome(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor={`${uid}-2`}>Cor</label>
          <label className="color-pick-wrap" htmlFor={`${uid}-2`}>
            <div className="color-swatch" style={{ background: cor }} />
            <span className="color-swatch-label">{cor.toUpperCase()}</span>
            <Palette size={14} strokeWidth={2} style={{ color: 'var(--faint)' }} />
            <input id={`${uid}-2`} type="color" value={cor} onChange={e => setCor(e.target.value)} />
          </label>
        </div>

      </div>

      <div className="color-presets">
        {PRESET_COLORS.map(c => (
          <button
            key={c}
            type="button"
            className={`color-preset-dot ${cor === c ? 'selected' : ''}`}
            style={{ background: c }}
            onClick={() => setCor(c)}
            title={c}
          />
        ))}
      </div>

      <div className="form-actions" style={{ marginTop: '1.1rem' }}>
        <button className="btn btn-primary btn-full" onClick={handleSubmit}>
          {editingCat ? <Check size={15} strokeWidth={2.5} /> : <Plus size={15} strokeWidth={2.5} />}
          {editingCat ? 'Salvar alterações' : 'Criar categoria'}
        </button>
        {editingCat && (
          <button className="btn btn-ghost" onClick={() => setEditingCat(null)}>
            <X size={14} strokeWidth={2} />
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
