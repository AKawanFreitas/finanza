import { Pencil, Trash2, Archive, ArchiveRestore, Wallet, Landmark, PiggyBank, Banknote, TrendingUp } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { fmt } from '../../utils/formatters';
import { rotuloTipo } from './tipos';

const ICONE = { corrente: Landmark, poupanca: PiggyBank, carteira: Banknote, investimento: TrendingUp };
import IconButton from '../../components/IconButton';
import { useConfirm } from '../../components/Confirm';

export default function ContaList() {
  const { contas: todas, editingConta, setEditingConta, updateConta, delConta } = useFinance();
  const confirmar = useConfirm();
  const excluir = async c => {
    if (await confirmar({ titulo: `Excluir a conta “${c.nome}”?`, mensagem: 'Só é possível excluir contas sem movimentações. Esta ação não pode ser desfeita.', rotulo: 'Excluir' })) delConta(c.id);
  };
  // Cartões de crédito têm tela própria (limite, fatura, parcelas).
  const contas = todas.filter(c => c.tipo !== 'cartao');

  const alternarArquivo = c => updateConta(c.id, {
    nome: c.nome, tipo: c.tipo, cor: c.cor, saldo_inicial: c.saldo_inicial, arquivada: !c.arquivada,
  });

  return (
    <div className="hist-wrap">
      <div className="card-head">
        <div className="card-title"><Wallet size={20} />Suas contas</div>
        <div className="card-sub">{contas.length} {contas.length === 1 ? 'conta' : 'contas'}</div>
      </div>

      <div className="contas-grid">
        {contas.map(c => {
          const Icone = ICONE[c.tipo] ?? Wallet;
          return (
            <div key={c.id} className={`conta-card${editingConta?.id === c.id ? ' editing' : ''}${c.arquivada ? ' arquivada' : ''}`} style={{ '--cor': c.cor }}>
              <div className="conta-card-topo">
                <span className="conta-card-icone"><Icone size={20} strokeWidth={2.2} /></span>
                <div className="conta-card-nome">
                  <strong>{c.nome}</strong>
                  <small>{rotuloTipo(c.tipo)}{c.arquivada ? ' · arquivada' : ''}</small>
                </div>
              </div>
              <div className={`conta-card-saldo${c.saldo < 0 ? ' neg' : ''}`}>
                {c.saldo < 0 ? '−' : ''}{fmt(Math.abs(c.saldo))}
              </div>
              <div className="hist-actions conta-card-acoes">
                <IconButton label="Editar" onClick={() => setEditingConta(c)}>
                  <Pencil size={13} strokeWidth={2} />
                </IconButton>
                <IconButton label={c.arquivada ? 'Reativar' : 'Arquivar'} onClick={() => alternarArquivo(c)}>
                  {c.arquivada ? <ArchiveRestore size={13} strokeWidth={2} /> : <Archive size={13} strokeWidth={2} />}
                </IconButton>
                <IconButton label="Excluir (só contas sem movimentações)" danger onClick={() => excluir(c)}>
                  <Trash2 size={13} strokeWidth={2} />
                </IconButton>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
