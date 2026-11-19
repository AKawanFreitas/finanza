import { useRef, useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { Tag, Palette, Plus } from 'lucide-react';

const PRESET_COLORS = [
  '#22a84a', '#2563eb', '#e84057', '#d97706',
  '#7c3aed', '#0891b2', '#db2777', '#65a30d',
];

export default function CategoriaForm() {
  const { addCategoria } = useFinance();
  const [nome, setNome] = useState('');
  const [cor, setCor]   = useState('#22a84a');
  const colorRef        = useRef(null);

  async function handleSubmit() {
    if (!nome.trim()) return;
    const ok = await addCategoria({ nome: nome.trim(), cor });
    if (ok) setNome('');
  }

  return (
    <div className="form-wrap">
      <div className="form-header">
        <div className="form-header-icon">
          <Tag size={18} strokeWidth={2} />
        </div>
        <div className="form-header-text">
          <div className="form-header-title">Nova categoria</div>
          <div className="form-header-sub">Crie categorias personalizadas para organizar seus gastos</div>
        </div>
      </div>

      <div className="form-grid">

        <div className="form-group">
          <label className="form-label">Nome</label>
          <div className="form-input-wrap">
            <span className="form-prefix"><Tag size={14} strokeWidth={2} /></span>
            <input
              className="form-control"
              placeholder="Ex: Lazer"
              value={nome}
              onChange={e => setNome(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Cor</label>
          <div
            className="color-pick-wrap"
            onClick={() => colorRef.current?.click()}
          >
            <div className="color-swatch" style={{ background: cor }} />
            <span className="color-swatch-label">{cor.toUpperCase()}</span>
            <Palette size={14} strokeWidth={2} style={{ color: 'var(--text3)' }} />
            <input ref={colorRef} type="color" value={cor} onChange={e => setCor(e.target.value)} />
          </div>
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
          <Plus size={15} strokeWidth={2.5} />
          Criar categoria
        </button>
      </div>
    </div>
  );
}
