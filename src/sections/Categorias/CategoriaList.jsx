import { Pencil, Trash2 } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';

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
          return (
            <div key={c.id} className={`cat-admin-row ${editingCat?.id === c.id ? 'editing' : ''}`}>
              <span className="dot" style={{ background: c.cor }} />
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
