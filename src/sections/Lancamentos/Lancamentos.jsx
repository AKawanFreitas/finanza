import TransactionForm from './TransactionForm';
import TransactionList from './TransactionList';

export default function Lancamentos() {
  return (
    <div className="section-enter">
      <div className="page-header">
        <div>
          <div className="page-title">Lançamentos</div>
          <div className="page-subtitle">Registre entradas e saídas</div>
        </div>
      </div>
      <TransactionForm />
      <TransactionList />
    </div>
  );
}
