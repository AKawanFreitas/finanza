import { Wallet } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import { useFinance } from '../../context/FinanceContext';
import { fmt } from '../../utils/formatters';
import ContaForm from './ContaForm';
import ContaList from './ContaList';
import Transferencias from './Transferencias';

export default function Contas() {
  const { contas, editingConta, setEditingConta } = useFinance();
  const total = contas.filter(c => !c.arquivada).reduce((a, c) => a + c.saldo, 0);
  const temCartao = contas.some(c => c.tipo === 'cartao' && !c.arquivada);

  return (
    <div className="section-enter">
      <PageHeader Icon={Wallet} titulo="Contas" subtitulo="Carteiras, bancos e transferências entre elas">
        <div className="saldo-total">
          <small>Saldo total{temCartao ? ' (já descontando os cartões)' : ''}</small>
          <strong className={total < 0 ? 'neg' : ''}>{total < 0 ? '−' : ''}{fmt(Math.abs(total))}</strong>
        </div>
      </PageHeader>
      <ContaForm />
      <ContaList />
      <Transferencias />
      {editingConta && (
        <Modal titulo="Editar conta" larga onFechar={() => setEditingConta(null)}>
          <p className="modal-sub">Altere os dados e salve.</p>
          <ContaForm editar={editingConta} onConcluir={() => setEditingConta(null)} />
        </Modal>
      )}
    </div>
  );
}
