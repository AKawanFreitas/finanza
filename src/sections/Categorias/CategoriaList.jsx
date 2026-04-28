import { Trash2 } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { catIcon } from '../../utils/formatters';

export default function CategoriaList() {
  const { categorias, delCategoria } = useFinance();

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
            <div key={c.id} className="cat-admin-row">
              <div
                className="cat-swatch"
                style={{ background: c.cor, width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}
              >
                <CatIcon size={14} strokeWidth={2} />
              </div>
              <div className="cat-admin-name">{c.nome}</div>
              <button className="del-btn" onClick={() => delCategoria(c.id)} title="Excluir">
                <Trash2 size={13} strokeWidth={2} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
