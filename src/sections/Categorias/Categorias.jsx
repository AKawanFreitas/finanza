import { useFinance } from '../../context/FinanceContext';
import Recolhivel from '../../components/Recolhivel';
import CategoriaForm from './CategoriaForm';
import CategoriaList from './CategoriaList';

export default function Categorias() {
  const { editingCat } = useFinance();
  return (
    <div className="section-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Categorias</h1>
          <p className="page-subtitle">Gerencie suas categorias de gasto</p>
        </div>
      </div>
      <Recolhivel rotulo="Nova categoria" forcarAberto={Boolean(editingCat)}><CategoriaForm /></Recolhivel>
      <CategoriaList />
    </div>
  );
}
