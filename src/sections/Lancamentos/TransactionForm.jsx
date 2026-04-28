import { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { today } from '../../utils/formatters';
import Select from '../../components/Select';
import {
  AlignLeft, Tag, Calendar, MessageSquare,
  ArrowDownLeft, ArrowUpRight, Plus, RotateCcw, PlusCircle
} from 'lucide-react';

const EMPTY = (cats) => ({ desc: '', valor: '', tipo: 'saida', cat: cats[0]?.nome || '', data: today(), obs: '' });

export default function TransactionForm() {
  const { categorias, addTransaction } = useFinance();
  const [form, setForm] = useState(EMPTY(categorias));

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  function handleSubmit() {
    if (!form.desc || !form.valor || !form.data) return;
    addTransaction({ ...form, valor: parseFloat(form.valor) });
    setForm(EMPTY(categorias));
  }

  const catOptions = categorias.map(c => ({ value: c.nome, label: c.nome, color: c.cor }));
  const isEntrada  = form.tipo === 'entrada';

  return (
    <div className="form-wrap">
      <div className="form-header">
        <div className="form-header-icon">
          <PlusCircle size={18} strokeWidth={2} />
        </div>
        <div className="form-header-text">
          <div className="form-header-title">Novo lançamento</div>
          <div className="form-header-sub">Registre uma entrada ou saída financeira</div>
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
          <Plus size={15} strokeWidth={2.5} />
          Adicionar lançamento
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => setForm(EMPTY(categorias))}
          title="Limpar formulário"
        >
          <RotateCcw size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
