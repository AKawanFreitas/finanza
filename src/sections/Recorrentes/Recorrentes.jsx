import { useFinance } from '../../context/FinanceContext';
import Recolhivel from '../../components/Recolhivel';
import RecorrenteForm from './RecorrenteForm';
import RecorrenteList from './RecorrenteList';

export default function Recorrentes() {
  const { editingRec } = useFinance();
  return (
    <div className="section-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Recorrentes</h1>
          <p className="page-subtitle">Gastos fixos e recorrentes mensais</p>
        </div>
      </div>
      <Recolhivel rotulo="Novo recorrente" forcarAberto={Boolean(editingRec)}><RecorrenteForm /></Recolhivel>
      <RecorrenteList />
    </div>
  );
}
