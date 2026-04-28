import { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';

export default function RecorrenteForm() {
  const { categorias, addRecorrente } = useFinance();
  const [form, setForm] = useState({ nome: '', valor: '', tipo: 'fixo', cat: categorias[0]?.nome || '', dia: '', obs: '' });

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function handleSubmit() {
    if (!form.nome || !form.valor || !form.dia) return;
    addRecorrente({ ...form, valor: parseFloat(form.valor), dia: parseInt(form.dia) });
    setForm({ nome: '', valor: '', tipo: 'fixo', cat: categorias[0]?.nome || '', dia: '', obs: '' });
  }

  return (
    <div className="form-wrap">
      <div className="form-title">Adicionar recorrente</div>
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">Nome</label>
          <input className="form-control" placeholder="Ex: Aluguel" value={form.nome} onChange={e => set('nome', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Valor (R$)</label>
          <input className="form-control" type="number" placeholder="0,00" min="0" step="0.01" value={form.valor} onChange={e => set('valor', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Tipo</label>
          <select className="form-control" value={form.tipo} onChange={e => set('tipo', e.target.value)}>
            <option value="fixo">Fixo</option>
            <option value="recorrente">Recorrente variável</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Categoria</label>
          <select className="form-control" value={form.cat} onChange={e => set('cat', e.target.value)}>
            {categorias.map(c => <option key={c.nome}>{c.nome}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Dia do vencimento</label>
          <input className="form-control" type="number" min="1" max="31" placeholder="Ex: 5" value={form.dia} onChange={e => set('dia', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Observação</label>
          <input className="form-control" placeholder="Opcional" value={form.obs} onChange={e => set('obs', e.target.value)} />
        </div>
      </div>
      <div className="form-actions">
        <button className="btn btn-primary" onClick={handleSubmit}>Adicionar</button>
      </div>
    </div>
  );
}
