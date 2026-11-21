import { useState } from 'react';
import Modal from './Modal';
import { useFinance } from '../context/FinanceContext';
import { fmt, today } from '../utils/formatters';

// Diálogo para marcar uma conta como paga: escolhe a conta e a data do pagamento.
export default function PagarConta({ conta, onConfirmar, onCancelar }) {
  const { contas } = useFinance();
  const disponiveis = contas.filter(c => !c.arquivada);
  const [contaId, setContaId] = useState(conta.conta_id ?? disponiveis[0]?.id);
  const [data, setData] = useState(today());

  return (
    <Modal titulo={`Pagar “${conta.descricao}”`} tituloId="titulo-pagar" variante="folha" onFechar={onCancelar}>
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
    </Modal>
  );
}
