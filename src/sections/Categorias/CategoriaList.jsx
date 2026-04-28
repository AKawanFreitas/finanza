import { useFinance } from '../../context/FinanceContext';

export default function CategoriaList() {
  const { categorias, delCategoria } = useFinance();

  return (
    <div className="hist-wrap">
      <div className="card-head" style={{ marginBottom: '1rem' }}>
        <div className="card-title">Categorias cadastradas</div>
      </div>
      <div className="cat-admin-grid">
        {categorias.map((c) => (
          <div key={c.id} className="cat-admin-row">
            <div className="cat-swatch" style={{ background: c.cor }} />
            <div className="cat-admin-name">{c.nome}</div>
            <button className="del-btn" onClick={() => delCategoria(c.id)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
