import RecorrenteForm from './RecorrenteForm';
import RecorrenteList from './RecorrenteList';

export default function Recorrentes() {
  return (
    <div className="section-enter">
      <div className="page-header">
        <div>
          <div className="page-title">Recorrentes</div>
          <div className="page-subtitle">Gastos fixos e recorrentes mensais</div>
        </div>
      </div>
      <RecorrenteForm />
      <RecorrenteList />
    </div>
  );
}
