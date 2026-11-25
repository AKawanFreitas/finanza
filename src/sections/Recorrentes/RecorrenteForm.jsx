import { useState, useEffect, useId } from 'react';
import { useFinance } from '../../context/FinanceContext';
import Select from '../../components/Select';
import FormHeader from '../../components/FormHeader';
import {
  AlignLeft, Tag, CalendarClock, MessageSquare,
  RefreshCw, Zap, Plus, Check, X, Wallet, Repeat, ArrowLeftRight, DollarSign, ArrowRight
} from 'lucide-react';
import { lerValor, valorParaCampo } from '../../utils/valor';
import useEnvioUnico from '../../utils/useEnvioUnico';

const EMPTY = (cats) => ({ nome: '', valor: '', tipo: 'fixo', cat: cats[0]?.nome || '', dia: '', obs: '', automatico: false, conta_id: null });

// Sem `editar`, cria um novo registro (na página). Com `editar`, edita aquele registro dentro do modal
// e chama `onConcluir` ao salvar ou cancelar.
export default function RecorrenteForm({ editar = null, onConcluir }) {
  const editingRec = editar;
  const uid = useId();
  const { categorias, contas, addRecorrente, updateRecorrente } = useFinance();
  const [form, setForm] = useState(EMPTY(categorias));

  useEffect(() => {
    if (editingRec) {
      const { nome, valor, tipo, cat, dia, obs, automatico, conta_id } = editingRec;
      setForm({ nome, valor: valorParaCampo(valor), tipo, cat, dia: String(dia), obs: obs || '', automatico: !!automatico, conta_id: conta_id ?? null });
    } else {
      setForm(EMPTY(categorias));
    }
  }, [editingRec, categorias]);

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  async function handleSubmit() {
    if (!form.nome || !form.valor || !form.dia) return;
    const { conta_id, ...resto } = form;
    // Sem conta escolhida, o lançamento automático usa a conta principal.
    const data = { ...resto, valor: lerValor(form.valor), dia: parseInt(form.dia), ...(conta_id ? { conta_id } : {}) };
    const ok = editingRec
      ? await updateRecorrente(editingRec.id, data)
      : await addRecorrente(data);
    if (!ok) return;
    if (editingRec) onConcluir?.();
    else setForm(EMPTY(categorias));
  }

  const catOptions = categorias.map(c => ({ value: c.nome, label: c.nome, color: c.cor, icone: c.icone }));
  const contaOptions = [
    { value: 0, label: 'Conta principal' },
    ...contas.filter(c => !c.arquivada || c.id === form.conta_id).map(c => ({ value: c.id, label: c.nome, color: c.cor })),
  ];

  const [enviarUmaVez, enviando] = useEnvioUnico(handleSubmit);

  return (
    <div className={editingRec ? 'form-modal' : 'form-wrap'}>
      {!editingRec && <FormHeader
        Icon={Repeat}
        titulo={editingRec ? 'Editar recorrente' : 'Adicionar recorrente'}
        subtitulo={editingRec ? 'Altere os dados e salve' : 'Despesas que se repetem todo mês'}
      />}

      <div className="form-grid">

        <div className="form-group form-span-2" role="group" aria-labelledby={`${uid}-tipo`}>
          <span className="form-label" id={`${uid}-tipo`}><ArrowLeftRight size={16} />Tipo</span>
          <div className="tipo-toggle">
            <button
              type="button"
              className={`tipo-btn ${form.tipo === 'fixo' ? 'active-fixo' : ''}`}
              aria-pressed={form.tipo === 'fixo'}
              onClick={() => set('tipo', 'fixo')}
            >
              <Zap size={14} strokeWidth={2.5} />
              Fixo
            </button>
            <button
              type="button"
              className={`tipo-btn ${form.tipo === 'recorrente' ? 'active-recorrente' : ''}`}
              aria-pressed={form.tipo === 'recorrente'}
              onClick={() => set('tipo', 'recorrente')}
            >
              <RefreshCw size={14} strokeWidth={2} />
              Recorrente variável
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor={`${uid}-1`}><AlignLeft size={16} />Nome</label>
          <div className="form-input-wrap">
            <span className="form-prefix"><AlignLeft size={16} strokeWidth={2} /></span>
            <input id={`${uid}-1`}
              className="form-control"
              placeholder="Ex: Aluguel"
              value={form.nome}
              onChange={e => set('nome', e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor={`${uid}-2`}><DollarSign size={16} />Valor</label>
          <div className="form-input-wrap has-text-prefix">
            <span className="form-prefix-text">R$</span>
            <input id={`${uid}-2`}
              className="form-control"
              type="text" inputMode="decimal" autoComplete="off"
              placeholder="0,00"
              value={form.valor}
              onChange={e => set('valor', e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor={`${uid}-3`}><Tag size={16} />Categoria</label>
          <Select id={`${uid}-3`}
            value={form.cat}
            onChange={v => set('cat', v)}
            options={catOptions}
            prefix={<Tag size={16} strokeWidth={2} />}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor={`${uid}-4`}><CalendarClock size={16} />Dia do vencimento</label>
          <div className="form-input-wrap">
            <span className="form-prefix"><CalendarClock size={16} strokeWidth={2} /></span>
            <input id={`${uid}-4`}
              className="form-control"
              type="number"
              min="1"
              max="31"
              placeholder="Ex: 5"
              value={form.dia}
              onChange={e => set('dia', e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor={`${uid}-5`}><Wallet size={16} />Conta do lançamento</label>
          <Select id={`${uid}-5`}
            value={form.conta_id ?? 0}
            onChange={v => set('conta_id', v || null)}
            options={contaOptions}
            prefix={<Wallet size={16} strokeWidth={2} />}
          />
        </div>

        <div className="form-group">
          <span className="form-label"><Zap size={16} />Lançamento</span>
          <label className="opcao-check opcao-compacta">
            <input type="checkbox" checked={form.automatico} onChange={e => set('automatico', e.target.checked)} />
            <span>
              <strong>Lançar automaticamente</strong>
              <small>No dia do vencimento, sem você precisar clicar.</small>
            </span>
          </label>
        </div>

        <div className="form-group form-span-2">
          <label className="form-label" htmlFor={`${uid}-6`}><MessageSquare size={16} />Observação <span className="form-label-opt">(opcional)</span></label>
          <div className="form-input-wrap">
            <span className="form-prefix"><MessageSquare size={16} strokeWidth={2} /></span>
            <input id={`${uid}-6`}
              className="form-control"
              placeholder="Algum detalhe adicional..."
              value={form.obs}
              onChange={e => set('obs', e.target.value)}
            />
          </div>
        </div>

      </div>

      <div className="form-actions">
        <button className="btn btn-primary btn-full" onClick={enviarUmaVez} disabled={enviando}>
          {editingRec ? <Check size={15} strokeWidth={2.5} /> : <Plus size={15} strokeWidth={2.5} />}
          {editingRec ? 'Salvar alterações' : 'Adicionar recorrente'}
          <ArrowRight size={15} strokeWidth={2.5} />
        </button>
        {editingRec && (
          <button className="btn btn-ghost" onClick={() => onConcluir?.()}>
            <X size={14} strokeWidth={2} />
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
