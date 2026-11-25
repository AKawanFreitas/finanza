import { useState, useEffect, useId } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { today, fmt } from '../../utils/formatters';
import FormHeader from '../../components/FormHeader';
import Select from '../../components/Select';
import { AlignLeft, Tag, Calendar, MessageSquare, Wallet, ArrowDownLeft, ArrowUpRight, Plus, RotateCcw, Check, X, ArrowLeftRight, DollarSign, Layers, Info, ArrowRight } from 'lucide-react';
import { lerValor, valorParaCampo } from '../../utils/valor';
import useEnvioUnico from '../../utils/useEnvioUnico';

const EMPTY = (cats, contas) => ({
  desc: '', valor: '', tipo: 'saida', cat: cats[0]?.nome || '', parcelas: '1',
  conta_id: contas.find(c => !c.arquivada)?.id ?? null, data: today(), obs: '',
});

// Sem `editar`, é o formulário de novo lançamento (na página). Com `editar`, edita aquele lançamento
// (dentro do modal) e chama `onConcluir` ao salvar ou cancelar.
export default function TransactionForm({ editar = null, onConcluir }) {
  const editing = editar;
  const uid = useId();
  const { categorias, contas, addTransaction, updateTransaction, showToast } = useFinance();
  const [form, setForm] = useState(EMPTY(categorias, contas));

  useEffect(() => {
    if (editing) {
      const { desc, valor, tipo, cat, conta_id, data, obs } = editing;
      setForm({ desc, valor: valorParaCampo(valor), tipo, cat, conta_id, data, obs: obs || '' });
    } else {
      setForm(EMPTY(categorias, contas));
    }
  }, [editing, categorias, contas]);

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  async function handleSubmit() {
    if (!form.desc.trim() || !form.valor || !form.data) return showToast('Preencha a descrição, o valor e a data para salvar.', 'err');
    // Parcelamento só existe ao criar uma compra no cartão; ao editar, cada parcela é um lançamento independente.
    const parcelas = Number(form.parcelas) || 1;
    const data = { ...form, valor: lerValor(form.valor) };
    delete data.parcelas;
    if (!editing && permiteParcelas && parcelas > 1) data.parcelas = parcelas;
    const ok = editing
      ? await updateTransaction(editing.id, data)
      : await addTransaction(data);
    if (!ok) return;
    if (editing) onConcluir?.();
    else setForm(EMPTY(categorias, contas));
  }

  const catOptions = categorias.map(c => ({ value: c.nome, label: c.nome, color: c.cor, icone: c.icone }));
  // Contas arquivadas não recebem lançamentos novos, exceto a que o lançamento em edição já usa.
  const contaOptions = contas
    .filter(c => !c.arquivada || c.id === form.conta_id)
    .map(c => ({ value: c.id, label: c.nome, color: c.cor }));
  const isEntrada  = form.tipo === 'entrada';
  const contaEscolhida = contas.find(c => c.id === form.conta_id);
  const permiteParcelas = contaEscolhida?.tipo === 'cartao' && !isEntrada;
  const nParcelas = Math.max(1, Math.min(48, Number(form.parcelas) || 1));
  const valorParcela = lerValor(form.valor) > 0 ? lerValor(form.valor) / nParcelas : 0;

  const [enviarUmaVez, enviando] = useEnvioUnico(handleSubmit);

  return (
    <div className={editing ? 'form-modal' : 'form-wrap'}>
      {!editing && <FormHeader Icon={ArrowLeftRight} titulo="Novo lançamento" subtitulo="Registre uma entrada ou saída financeira" />}

      <div className="form-grid">

        <div className="form-group form-span-2" role="group" aria-labelledby={`${uid}-tipo`}>
          <span className="form-label" id={`${uid}-tipo`}><ArrowLeftRight size={16} />Tipo</span>
          <div className="tipo-toggle">
            <button
              type="button"
              className={`tipo-btn ${!isEntrada ? 'active-saida' : ''}`}
              aria-pressed={!isEntrada}
              onClick={() => set('tipo', 'saida')}
            >
              <ArrowUpRight size={14} strokeWidth={2.5} />
              Saída
            </button>
            <button
              type="button"
              className={`tipo-btn ${isEntrada ? 'active-entrada' : ''}`}
              aria-pressed={isEntrada}
              onClick={() => set('tipo', 'entrada')}
            >
              <ArrowDownLeft size={14} strokeWidth={2.5} />
              Entrada
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor={`${uid}-1`}><AlignLeft size={16} />Descrição</label>
          <div className="form-input-wrap">
            <span className="form-prefix"><AlignLeft size={16} strokeWidth={2} /></span>
            <input id={`${uid}-1`}
              className="form-control"
              placeholder="Ex: Supermercado"
              value={form.desc}
              onChange={e => set('desc', e.target.value)}
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
            prefix={<Tag size={14} strokeWidth={2} />}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor={`${uid}-4`}><Wallet size={16} />Conta</label>
          <Select id={`${uid}-4`}
            value={form.conta_id}
            onChange={v => set('conta_id', v)}
            options={contaOptions}
            prefix={<Wallet size={14} strokeWidth={2} />}
          />
        </div>

        {permiteParcelas && !editing && (
          <div className="form-group">
            <label className="form-label" htmlFor={`${uid}-5`}><Layers size={16} />Parcelas</label>
            <input id={`${uid}-5`}
              className="form-control" type="number" min="1" max="48" step="1"
              value={form.parcelas} onChange={e => set('parcelas', e.target.value)}
              aria-label="Número de parcelas"
            />
            {nParcelas > 1 && valorParcela > 0 && (
              <span className="form-dica parcelas-info"><Info size={14} />{nParcelas}x de ~{fmt(valorParcela)}, uma por fatura</span>
            )}
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor={`${uid}-6`}><Calendar size={16} />Data</label>
          <div className="form-input-wrap">
            <span className="form-prefix"><Calendar size={16} strokeWidth={2} /></span>
            <input id={`${uid}-6`}
              className="form-control"
              type="date"
              value={form.data}
              onChange={e => set('data', e.target.value)}
            />
          </div>
        </div>

        <div className="form-group form-span-2">
          <label className="form-label" htmlFor={`${uid}-7`}><MessageSquare size={16} />Observação <span className="form-label-opt">(opcional)</span></label>
          <div className="form-input-wrap">
            <span className="form-prefix"><MessageSquare size={16} strokeWidth={2} /></span>
            <input id={`${uid}-7`}
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
          {editing ? <Check size={15} strokeWidth={2.5} /> : <Plus size={15} strokeWidth={2.5} />}
          {editing ? 'Salvar alterações' : 'Adicionar lançamento'}
        <ArrowRight size={15} strokeWidth={2.5} />
        </button>
        {editing ? (
          <button className="btn btn-ghost" onClick={() => onConcluir?.()}>
            <X size={14} strokeWidth={2} />
            Cancelar
          </button>
        ) : (
          <button
            className="btn btn-ghost"
            onClick={() => setForm(EMPTY(categorias, contas))}
            title="Limpar formulário"
          >
            <RotateCcw size={14} strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
}
