import CategoriaForm from './CategoriaForm';
import CategoriaList from './CategoriaList';

export default function Categorias() {
  return (
    <div className="section-enter">
      <div className="page-header">
        <div>
          <div className="page-title">Categorias</div>
          <div className="page-subtitle">Gerencie suas categorias de gasto</div>
        </div>
      </div>
      <CategoriaForm />
      <CategoriaList />
    </div>
  );
}
