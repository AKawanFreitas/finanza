import { Pencil, Trash2, Archive, ArchiveRestore } from 'lucide-react';
import { useConfirmar } from '../../components/useConfirmar';
import { useFinance } from '../../context/FinanceContext';
import { fmt } from '../../utils/formatters';
import { rotuloTipo } from './tipos';

export default function ContaList() {
  const { contas: todas, editingConta, setEditingConta, updateConta, delConta } = useFinance();
  const [pedirConfirmacao, dialogoConfirmar] = useConfirmar();
  // Cartões de crédito têm tela própria (limite, fatura, parcelas).
  const contas = todas.filter(c => c.tipo !== 'cartao');

  const alternarArquivo = c => updateConta(c.id, {
    nome: c.nome, tipo: c.tipo, cor: c.cor, saldo_inicial: c.saldo_inicial, arquivada: !c.arquivada,
  });

  return (
    <div className="hist-wrap">
      <div className="card-head" style={{ marginBottom: '0.25rem' }}>
        <div className="card-title">Suas contas</div>
        <div className="card-sub">{contas.length} {contas.length === 1 ? 'conta' : 'contas'}</div>
      </div>

      <div className="rec-grid">
        {contas.map(c => (
          <div key={c.id} className={`rec-card${editingConta?.id === c.id ? ' editing' : ''}${c.arquivada ? ' arquivada' : ''}`}>
            <div className="rec-left">
              <span className="dot" style={{ background: c.cor }} />
              <div>
                <div className="rec-name-text">{c.nome}</div>
                <div className="rec-detail-text">
                  {rotuloTipo(c.tipo)}{c.arquivada ? ' · arquivada' : ''}
                </div>
              </div>
            </div>
            <div className="rec-right">
              <div className={`rec-amount${c.saldo < 0 ? ' neg' : ''}`}>
                {c.saldo < 0 ? '−' : ''}{fmt(Math.abs(c.saldo))}
              </div>
              <div className="hist-actions">
                <button className="del-btn" aria-label="Editar" title="Editar" onClick={() => { setEditingConta(c); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                  <Pencil size={13} strokeWidth={2} />
                </button>
                <button className="del-btn" aria-label={c.arquivada ? 'Reativar' : 'Arquivar'} title={c.arquivada ? 'Reativar' : 'Arquivar'} onClick={() => alternarArquivo(c)}>
                  {c.arquivada ? <ArchiveRestore size={13} strokeWidth={2} /> : <Archive size={13} strokeWidth={2} />}
                </button>
                <button className="del-btn" aria-label="Excluir" title="Excluir (só contas sem movimentações)" onClick={() => pedirConfirmacao({ titulo: 'Excluir conta?', texto: `“${c.nome}” será removida. Só é possível se ela não tiver movimentações.` }, () => delConta(c.id))}>
                  <Trash2 size={13} strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {dialogoConfirmar}
    </div>
  );
}
