import { Repeat } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import RecorrenteForm from './RecorrenteForm';
import RecorrenteList from './RecorrenteList';

export default function Recorrentes() {
  return (
    <div className="section-enter">
      <PageHeader Icon={Repeat} titulo="Recorrentes" subtitulo="Gastos fixos e recorrentes mensais" />
      <RecorrenteForm />
      <RecorrenteList />
    </div>
  );
}
