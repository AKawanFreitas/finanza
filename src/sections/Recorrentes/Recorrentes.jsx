import { Repeat } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import RecorrenteForm from './RecorrenteForm';
import RecorrenteList from './RecorrenteList';

export default function Recorrentes() {
  const { editingRec, setEditingRec } = useFinance();

  return (
    <div className="section-enter">
      <PageHeader Icon={Repeat} titulo="Recorrentes" subtitulo="Gastos e receitas que se repetem todo mês" />
      <RecorrenteForm />
      <RecorrenteList />
      {editingRec && (
        <Modal titulo="Editar recorrente" larga onFechar={() => setEditingRec(null)}>
          <p className="modal-sub">Altere os dados e salve.</p>
          <RecorrenteForm editar={editingRec} onConcluir={() => setEditingRec(null)} />
        </Modal>
      )}
    </div>
  );
}
