import { Tags } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import CategoriaForm from './CategoriaForm';
import CategoriaList from './CategoriaList';

export default function Categorias() {
  return (
    <div className="section-enter">
      <PageHeader Icon={Tags} titulo="Categorias" subtitulo="Gerencie suas categorias de gasto" />
      <CategoriaForm />
      <CategoriaList />
    </div>
  );
}
