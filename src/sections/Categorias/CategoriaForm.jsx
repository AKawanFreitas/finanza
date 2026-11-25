import { useEffect, useState, useId } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { Tag, Shapes, Plus, Check, X, Type, ArrowRight } from 'lucide-react';
import FormHeader from '../../components/FormHeader';
import CampoCor from '../../components/CampoCor';
import CategoriaIcone from '../../components/CategoriaIcone';
import { ICONES_CATEGORIA } from '../../utils/iconesCategoria';
import useEnvioUnico from '../../utils/useEnvioUnico';

const PRESET_COLORS = [
  '#22a84a', '#2563eb', '#e84057', '#d97706',
  '#7c3aed', '#0891b2', '#db2777', '#65a30d',
];

// Sem `editar`, cria um novo registro (na página). Com `editar`, edita aquele registro dentro do modal
// e chama `onConcluir` ao salvar ou cancelar.
export default function CategoriaForm({ editar = null, onConcluir }) {
  const editingCat = editar;
  const uid = useId();
  const { addCategoria, updateCategoria, showToast } = useFinance();
  const [nome, setNome] = useState('');
  const [cor, setCor]   = useState('#22a84a');
  const [icone, setIcone] = useState('tag');

  useEffect(() => {
    setNome(editingCat?.nome ?? '');
    setCor(editingCat?.cor ?? '#22a84a');
    setIcone(editingCat?.icone ?? 'tag');
  }, [editingCat]);

  async function handleSubmit() {
    if (!nome.trim()) return showToast('Preencha o nome da categoria para salvar.', 'err');
    const data = { nome: nome.trim(), cor, icone };
    const ok = editingCat ? await updateCategoria(editingCat.id, data) : await addCategoria(data);
    if (!ok) return;
    if (editingCat) onConcluir?.();
    else { setNome(''); setIcone('tag'); }
  }

  const [enviarUmaVez, enviando] = useEnvioUnico(handleSubmit);

  return (
    <div className={editingCat ? 'form-modal' : 'form-wrap'}>
      {!editingCat && <FormHeader
        Icon={Tag}
        titulo={editingCat ? 'Editar categoria' : 'Nova categoria'}
        subtitulo={editingCat
          ? 'Renomear atualiza também os lançamentos e recorrentes dessa categoria'
          : 'Crie categorias personalizadas para organizar seus gastos'}
      />}

      <div className="form-grid">

        <div className="form-group">
          <label className="form-label" htmlFor={`${uid}-1`}><Type size={16} />Nome</label>
          <div className="form-input-wrap">
            <span className="form-prefix"><Tag size={16} strokeWidth={2} /></span>
            <input id={`${uid}-1`}
              className="form-control"
              placeholder="Ex: Lazer"
              value={nome}
              onChange={e => setNome(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && enviarUmaVez()}
            />
          </div>
        </div>
        <CampoCor valor={cor} onChange={setCor} cores={PRESET_COLORS} />

      </div>

      <div className="form-group icone-bloco" role="group" aria-labelledby={`${uid}-icone`}>
        <span className="form-label" id={`${uid}-icone`}><Shapes size={16} />Ícone</span>
        <div className="icone-grid">
          {ICONES_CATEGORIA.map(({ chave, Icone, rotulo }) => (
            <button
              key={chave} type="button" title={rotulo} aria-label={rotulo} aria-pressed={icone === chave}
              className={`icone-opcao${icone === chave ? ' selected' : ''}`}
              style={{ '--cor': cor }} onClick={() => setIcone(chave)}
            >
              <Icone size={20} strokeWidth={2} />
            </button>
          ))}
        </div>
        <span className="icone-previa"><CategoriaIcone icone={icone} cor={cor} tam={40} /> {nome.trim() || 'Sua categoria'}</span>
      </div>

      <div className="form-actions" style={{ marginTop: '1.1rem' }}>
        <button className="btn btn-primary btn-full" onClick={enviarUmaVez} disabled={enviando}>
          {editingCat ? <Check size={15} strokeWidth={2.5} /> : <Plus size={15} strokeWidth={2.5} />}
          {editingCat ? 'Salvar alterações' : 'Criar categoria'}
          <ArrowRight size={15} strokeWidth={2.5} />
        </button>
        {editingCat && (
          <button className="btn btn-ghost" onClick={() => onConcluir?.()}>
            <X size={14} strokeWidth={2} />
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
