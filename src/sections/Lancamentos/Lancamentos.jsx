import { ArrowLeftRight } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import TransactionForm from './TransactionForm';
import TransactionList from './TransactionList';

export default function Lancamentos() {
  return (
    <div className="section-enter">
      <PageHeader Icon={ArrowLeftRight} titulo="Lançamentos" subtitulo="Registre entradas e saídas" />
      <TransactionForm />
      <TransactionList />
    </div>
  );
}
