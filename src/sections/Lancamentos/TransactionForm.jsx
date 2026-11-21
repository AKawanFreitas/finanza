import { useState, useEffect } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { today, fmt } from '../../utils/formatters';
import Select from '../../components/Select';
import {
  AlignLeft, Tag, Calendar, MessageSquare, Wallet,
  ArrowDownLeft, ArrowUpRight, Plus, RotateCcw, Check, X
} from 'lucide-react';

const EMPTY = (cats, contas) => ({
  desc: '', valor: '', tipo: 'saida', cat: cats[0]?.nome || '', parcelas: '1',
  conta_id: contas.find(c => !c.arquivada)?.id ?? null, data: today(), obs: '',
});

export default function TransactionForm() {
  const { categorias, contas, addTransaction, updateTransaction, editing, setEditing } = useFinance();
  const [form, setForm] = useState(EMPTY(categorias, contas));

  useEffect(() => {
    if (editing) {
      const { desc, valor, tipo, cat, conta_id, data, obs } = editing;
      setForm({ desc, valor: String(valor), tipo, cat, conta_id, data, obs: obs || '' });
    } else {
      setForm(EMPTY(categorias, contas));
    }
  }, [editing, categorias, contas]);

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  async function handleSubmit() {
    if (!form.desc || !form.valor || !form.data) return;
    // Parcelamento só existe ao criar uma compra no cartão; ao editar, cada parcela é um lançamento independente.
    const parcelas = Number(form.parcelas) || 1;
    const data = { ...form, valor: parseFloat(form.valor) };
    delete data.parcelas;
    if (!editing && permiteParcelas && parcelas > 1) data.parcelas = parcelas;
    const ok = editing
      ? await updateTransaction(editing.id, data)
      : await addTransaction(data);
    if (!ok) return;
    if (editing) setEditing(null);
    else setForm(EMPTY(categorias, contas));
  }

  const catOptions = categorias.map(c => ({ value: c.nome, label: c.nome, color: c.cor }));
  // Contas arquivadas não recebem lançamentos novos, exceto a que o lançamento em edição já usa.
  const contaOptions = contas
    .filter(c => !c.arquivada || c.id === form.conta_id)
    .map(c => ({ value: c.id, label: c.nome, color: c.cor }));
  const isEntrada  = form.tipo === 'entrada';
  const contaEscolhida = contas.find(c => c.id === form.conta_id);
  const permiteParcelas = contaEscolhida?.tipo === 'cartao' && !isEntrada;
  const nParcelas = Math.max(1, Math.min(48, Number(form.parcelas) || 1));
  const valorParcela = parseFloat(form.valor) > 0 ? parseFloat(form.valor) / nParcelas : 0;

  return (
    <div className="form-wrap">
      <div className="form-header">
        <div className="form-header-text">
          <div className="form-header-title">{editing ? 'Editar lançamento' : 'Novo lançamento'}</div>
          <div className="form-header-sub">
            {editing ? 'Altere os dados e salve' : 'Registre uma entrada ou saída financeira'}
          </div>
        </div>
      </div>

      <div className="form-grid">

        <div className="form-group form-span-2">
          <label className="form-label">Tipo</label>
          <div className="tipo-toggle">
            <button
              type="button"
              className={`tipo-btn ${!isEntrada ? 'active-saida' : ''}`}
              onClick={() => set('tipo', 'saida')}
            >
              <ArrowUpRight size={14} strokeWidth={2.5} />
              Saída
            </button>
            <button
              type="button"
              className={`tipo-btn ${isEntrada ? 'active-entrada' : ''}`}
              onClick={() => set('tipo', 'entrada')}
            >
              <ArrowDownLeft size={14} strokeWidth={2.5} />
              Entrada
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Descrição</label>
          <div className="form-input-wrap">
            <span className="form-prefix"><AlignLeft size={14} strokeWidth={2} /></span>
            <input
              className="form-control"
              placeholder="Ex: Supermercado"
              value={form.desc}
              onChange={e => set('desc', e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Valor</label>
          <div className="form-input-wrap has-text-prefix">
            <span className="form-prefix-text">R$</span>
            <input
              className="form-control"
              type="number"
              placeholder="0,00"
              min="0"
              step="0.01"
              value={form.valor}
              onChange={e => set('valor', e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Categoria</label>
          <Select
            value={form.cat}
            onChange={v => set('cat', v)}
            options={catOptions}
            prefix={<Tag size={14} strokeWidth={2} />}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Conta</label>
          <Select
            value={form.conta_id}
            onChange={v => set('conta_id', v)}
            options={contaOptions}
            prefix={<Wallet size={14} strokeWidth={2} />}
          />
        </div>

        {permiteParcelas && !editing && (
          <div className="form-group">
            <label className="form-label">Parcelas</label>
            <input
              className="form-control" type="number" min="1" max="48" step="1"
              value={form.parcelas} onChange={e => set('parcelas', e.target.value)}
              aria-label="Número de parcelas"
            />
            {nParcelas > 1 && valorParcela > 0 && (
              <span className="parcelas-info">{nParcelas}x de ~{fmt(valorParcela)}, uma por fatura</span>
            )}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Data</label>
          <div className="form-input-wrap">
            <span className="form-prefix"><Calendar size={14} strokeWidth={2} /></span>
            <input
              className="form-control"
              type="date"
              value={form.data}
              onChange={e => set('data', e.target.value)}
            />
          </div>
        </div>

        <div className="form-group form-span-2">
          <label className="form-label">Observação <span className="form-label-opt">(opcional)</span></label>
          <div className="form-input-wrap">
            <span className="form-prefix"><MessageSquare size={14} strokeWidth={2} /></span>
            <input
              className="form-control"
              placeholder="Algum detalhe adicional..."
              value={form.obs}
              onChange={e => set('obs', e.target.value)}
            />
          </div>
        </div>

      </div>

      <div className="form-actions">
        <button className="btn btn-primary btn-full" onClick={handleSubmit}>
          {editing ? <Check size={15} strokeWidth={2.5} /> : <Plus size={15} strokeWidth={2.5} />}
          {editing ? 'Salvar alterações' : 'Adicionar lançamento'}
        </button>
        {editing ? (
          <button className="btn btn-ghost" onClick={() => setEditing(null)}>
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
