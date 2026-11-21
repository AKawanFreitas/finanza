import { useEffect, useState } from 'react';
import { Plus, ChevronUp } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import TransactionForm from './TransactionForm';
import TransactionList from './TransactionList';

// No computador o formulário já abre; no celular fica recolhido para a lista aparecer primeiro.
const telaGrande = () => window.matchMedia('(min-width: 861px)').matches;

export default function Lancamentos({ novo }) {
  const { editing } = useFinance();
  const [aberto, setAberto] = useState(() => novo || telaGrande());
  // Chegar por #/lancamento/novo (botão +, voltar/avançar) abre o formulário mesmo com a tela já montada.
  useEffect(() => { if (novo) setAberto(true); }, [novo]);
  const mostrar = aberto || Boolean(editing);

  return (
    <div className="section-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Lançamentos</h1>
          <p className="page-subtitle">Registre entradas e saídas</p>
        </div>
        {!editing && (
          <button className="btn btn-primary btn-so-celular" aria-expanded={mostrar} onClick={() => setAberto(a => !a)}>
            {mostrar ? <ChevronUp size={16} strokeWidth={2.5} /> : <Plus size={16} strokeWidth={2.5} />}
            {mostrar ? 'Fechar' : 'Novo lançamento'}
          </button>
        )}
      </div>
      {mostrar && <TransactionForm onSalvo={() => { if (!telaGrande()) setAberto(false); }} />}
      <TransactionList />
    </div>
  );
}
