import { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { today } from '../../utils/formatters';

export default function TransactionForm() {
  const { categorias, addTransaction } = useFinance();
  const [form, setForm] = useState({ desc: '', valor: '', tipo: 'saida', cat: categorias[0]?.nome || '', data: today(), obs: '' });

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function handleSubmit() {
    if (!form.desc || !form.valor || !form.data) return;
    addTransaction({ ...form, valor: parseFloat(form.valor) });
    setForm({ desc: '', valor: '', tipo: 'saida', cat: categorias[0]?.nome || '', data: today(), obs: '' });
  }

  return (
    <div className="form-wrap">
      <div className="form-title">Novo lançamento</div>
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">Descrição</label>
          <input className="form-control" placeholder="Ex: Supermercado" value={form.desc} onChange={e => set('desc', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Valor (R$)</label>
          <input className="form-control" type="number" placeholder="0,00" min="0" step="0.01" value={form.valor} onChange={e => set('valor', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Tipo</label>
          <select className="form-control" value={form.tipo} onChange={e => set('tipo', e.target.value)}>
            <option value="saida">Saída (gasto)</option>
            <option value="entrada">Entrada (receita)</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Categoria</label>
          <select className="form-control" value={form.cat} onChange={e => set('cat', e.target.value)}>
            {categorias.map(c => <option key={c.nome}>{c.nome}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Data</label>
          <input className="form-control" type="date" value={form.data} onChange={e => set('data', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Observação</label>
          <input className="form-control" placeholder="Opcional" value={form.obs} onChange={e => set('obs', e.target.value)} />
        </div>
      </div>
      <div className="form-actions">
        <button className="btn btn-primary" onClick={handleSubmit}>Adicionar</button>
        <button className="btn" onClick={() => setForm({ desc: '', valor: '', tipo: 'saida', cat: categorias[0]?.nome || '', data: today(), obs: '' })}>Limpar</button>
      </div>
    </div>
  );
}
