import { useEffect, useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { fmt, today } from '../utils/formatters';

// Diálogo para marcar uma conta como paga: escolhe a conta e a data do pagamento.
export default function PagarConta({ conta, onConfirmar, onCancelar }) {
  const { contas } = useFinance();
  const disponiveis = contas.filter(c => !c.arquivada);
  const [contaId, setContaId] = useState(conta.conta_id ?? disponiveis[0]?.id);
  const [data, setData] = useState(today());

  useEffect(() => {
    const fechar = e => e.key === 'Escape' && onCancelar();
    document.addEventListener('keydown', fechar);
    return () => document.removeEventListener('keydown', fechar);
  }, [onCancelar]);

  return (
    <div className="modal-fundo" onMouseDown={e => e.target === e.currentTarget && onCancelar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-pagar">
        <h2 id="titulo-pagar">Pagar “{conta.descricao}”</h2>
        <p>O valor de {fmt(conta.valor)} será lançado como gasto em {conta.cat}.</p>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label className="form-label">Pagar com</label>
          <select className="form-control" value={contaId} onChange={e => setContaId(Number(e.target.value))}>
            {disponiveis.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 18 }}>
          <label className="form-label">Data do pagamento</label>
          <input className="form-control" type="date" value={data} onChange={e => setData(e.target.value)} />
        </div>
        <div className="modal-acoes">
          <button className="btn btn-primary" onClick={() => onConfirmar({ conta_id: contaId, data })}>Confirmar pagamento</button>
          <button className="btn btn-ghost" onClick={onCancelar}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
