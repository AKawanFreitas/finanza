import { ArrowLeftRight } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import TransactionForm from './TransactionForm';
import TransactionList from './TransactionList';

export default function Lancamentos() {
  const { editing, setEditing } = useFinance();

  return (
    <div className="section-enter">
      <PageHeader Icon={ArrowLeftRight} titulo="Lançamentos" subtitulo="Registre entradas e saídas" />
      <TransactionForm />
      <TransactionList />
      {editing && (
        <Modal titulo="Editar lançamento" larga onFechar={() => setEditing(null)}>
          <p className="modal-sub">Altere os dados e salve.</p>
          <TransactionForm editar={editing} onConcluir={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}
