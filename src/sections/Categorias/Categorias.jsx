import { Tags } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import CategoriaForm from './CategoriaForm';
import CategoriaList from './CategoriaList';

export default function Categorias() {
  const { editingCat, setEditingCat } = useFinance();

  return (
    <div className="section-enter">
      <PageHeader Icon={Tags} titulo="Categorias" subtitulo="Gerencie suas categorias de gasto" />
      <CategoriaForm />
      <CategoriaList />
      {editingCat && (
        <Modal titulo="Editar categoria" larga onFechar={() => setEditingCat(null)}>
          <p className="modal-sub">Renomear atualiza também os lançamentos e recorrentes dessa categoria.</p>
          <CategoriaForm editar={editingCat} onConcluir={() => setEditingCat(null)} />
        </Modal>
      )}
    </div>
  );
}
