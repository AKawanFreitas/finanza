import { Pencil, Trash2 } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { catIcon } from '../../utils/formatters';

export default function CategoriaList() {
  const { categorias, delCategoria, editingCat, setEditingCat } = useFinance();

  return (
    <div className="hist-wrap">
      <div className="card-head" style={{ marginBottom: '1rem' }}>
        <div className="card-title">Categorias cadastradas</div>
        <div className="card-sub">{categorias.length} categorias</div>
      </div>
      <div className="cat-admin-grid">
        {categorias.map(c => {
          const CatIcon = catIcon(c.nome);
          return (
            <div key={c.id} className={`cat-admin-row ${editingCat?.id === c.id ? 'editing' : ''}`}>
              <div
                className="cat-swatch"
                style={{ background: c.cor, width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}
              >
                <CatIcon size={14} strokeWidth={2} />
              </div>
              <div className="cat-admin-name">{c.nome}</div>
              <div className="hist-actions">
                <button className="del-btn" onClick={() => { setEditingCat(c); window.scrollTo({ top: 0, behavior: 'smooth' }); }} title="Editar">
                  <Pencil size={13} strokeWidth={2} />
                </button>
                <button className="del-btn" onClick={() => delCategoria(c.id)} title="Excluir">
                  <Trash2 size={13} strokeWidth={2} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
