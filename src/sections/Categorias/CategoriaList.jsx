import { Pencil, Trash2 } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import IconButton from '../../components/IconButton';
import { useConfirm } from '../../components/Confirm';

export default function CategoriaList() {
  const { categorias, delCategoria, editingCat, setEditingCat } = useFinance();
  const confirmar = useConfirm();
  const excluir = async c => {
    if (await confirmar({ titulo: `Excluir a categoria “${c.nome}”?`, mensagem: 'Categorias com lançamentos não podem ser excluídas. Esta ação não pode ser desfeita.', rotulo: 'Excluir' })) delCategoria(c.id);
  };

  return (
    <div className="hist-wrap">
      <div className="card-head" style={{ marginBottom: '1rem' }}>
        <div className="card-title">Categorias cadastradas</div>
        <div className="card-sub">{categorias.length} categorias</div>
      </div>
      <div className="cat-admin-grid">
        {categorias.map(c => {
          return (
            <div key={c.id} className={`cat-admin-row ${editingCat?.id === c.id ? 'editing' : ''}`}>
              <span className="dot" style={{ background: c.cor }} />
              <div className="cat-admin-name">{c.nome}</div>
              <div className="hist-actions">
                <IconButton label="Editar" onClick={() => { setEditingCat(c); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                  <Pencil size={13} strokeWidth={2} />
                </IconButton>
                <IconButton label="Excluir" danger onClick={() => excluir(c)}>
                  <Trash2 size={13} strokeWidth={2} />
                </IconButton>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
