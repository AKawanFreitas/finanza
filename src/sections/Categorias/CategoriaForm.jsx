import { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';

export default function CategoriaForm() {
  const { addCategoria } = useFinance();
  const [nome, setNome] = useState('');
  const [cor, setCor]   = useState('#00d68f');

  function handleSubmit() {
    if (!nome.trim()) return;
    addCategoria({ nome: nome.trim(), cor });
    setNome('');
  }

  return (
    <div className="form-wrap">
      <div className="form-title">Nova categoria</div>
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">Nome</label>
          <input className="form-control" placeholder="Ex: Lazer" value={nome} onChange={e => setNome(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Cor</label>
          <input className="form-control" type="color" value={cor} onChange={e => setCor(e.target.value)} style={{ height: 41, padding: '4px 8px', cursor: 'pointer' }} />
        </div>
      </div>
      <div className="form-actions">
        <button className="btn btn-primary" onClick={handleSubmit}>Criar categoria</button>
      </div>
    </div>
  );
}
