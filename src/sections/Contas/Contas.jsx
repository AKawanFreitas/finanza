import { useFinance } from '../../context/FinanceContext';
import { fmt } from '../../utils/formatters';
import Recolhivel from '../../components/Recolhivel';
import ContaForm from './ContaForm';
import ContaList from './ContaList';
import Transferencias from './Transferencias';

export default function Contas() {
  const { contas, editingConta } = useFinance();
  const total = contas.filter(c => !c.arquivada).reduce((a, c) => a + c.saldo, 0);
  const temCartao = contas.some(c => c.tipo === 'cartao' && !c.arquivada);

  return (
    <div className="section-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Contas</h1>
          <p className="page-subtitle">Carteiras, bancos e transferências entre elas</p>
        </div>
        <div className="saldo-total">
          <small>Saldo total{temCartao ? ' (já descontando os cartões)' : ''}</small>
          <strong className={total < 0 ? 'neg' : ''}>{total < 0 ? '−' : ''}{fmt(Math.abs(total))}</strong>
        </div>
      </div>
      <Recolhivel rotulo="Nova conta" forcarAberto={Boolean(editingConta)}><ContaForm /></Recolhivel>
      <ContaList />
      <Transferencias />
    </div>
  );
}
