import { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import Select from '../../components/Select';
import {
  AlignLeft, Tag, CalendarClock, MessageSquare,
  RefreshCw, Zap, Plus
} from 'lucide-react';

const EMPTY = (cats) => ({ nome: '', valor: '', tipo: 'fixo', cat: cats[0]?.nome || '', dia: '', obs: '' });

export default function RecorrenteForm() {
  const { categorias, addRecorrente } = useFinance();
  const [form, setForm] = useState(EMPTY(categorias));

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  function handleSubmit() {
    if (!form.nome || !form.valor || !form.dia) return;
    addRecorrente({ ...form, valor: parseFloat(form.valor), dia: parseInt(form.dia) });
    setForm(EMPTY(categorias));
  }

  const catOptions = categorias.map(c => ({ value: c.nome, label: c.nome, color: c.cor }));

  return (
    <div className="form-wrap">
      <div className="form-header">
        <div className="form-header-icon">
          <RefreshCw size={18} strokeWidth={2} />
        </div>
        <div className="form-header-text">
          <div className="form-header-title">Adicionar recorrente</div>
          <div className="form-header-sub">Despesas que se repetem todo mês</div>
        </div>
      </div>

      <div className="form-grid">

        <div className="form-group form-span-2">
          <label className="form-label">Tipo</label>
          <div className="tipo-toggle">
            <button
              type="button"
              className={`tipo-btn ${form.tipo === 'fixo' ? 'active-fixo' : ''}`}
              onClick={() => set('tipo', 'fixo')}
            >
              <Zap size={14} strokeWidth={2.5} />
              Fixo
            </button>
            <button
              type="button"
              className={`tipo-btn ${form.tipo === 'recorrente' ? 'active-recorrente' : ''}`}
              onClick={() => set('tipo', 'recorrente')}
            >
              <RefreshCw size={14} strokeWidth={2} />
              Recorrente variável
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Nome</label>
          <div className="form-input-wrap">
            <span className="form-prefix"><AlignLeft size={14} strokeWidth={2} /></span>
            <input
              className="form-control"
              placeholder="Ex: Aluguel"
              value={form.nome}
              onChange={e => set('nome', e.target.value)}
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
          <label className="form-label">Dia do vencimento</label>
          <div className="form-input-wrap">
            <span className="form-prefix"><CalendarClock size={14} strokeWidth={2} /></span>
            <input
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
          Adicionar recorrente
        </button>
      </div>
    </div>
  );
}
