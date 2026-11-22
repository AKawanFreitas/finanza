import { useEffect, useState } from 'react';
import { Pencil, Trash2, CheckCircle2, Undo2 } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { api, query } from '../../utils/api';
import { fmt, fmtDate } from '../../utils/formatters';
import PagarConta from '../../components/PagarConta';
import ContaPagarForm from './ContaPagarForm';
import { ROTULO, CLASSE, descreverPrazo } from './status';
import IconButton from '../../components/IconButton';

const ABAS = [['abertas', 'Em aberto'], ['atrasada', 'Atrasadas'], ['paga', 'Pagas'], ['todas', 'Todas']];

export default function ContasPagar() {
  const { versao, invalidar, showToast } = useFinance();
  const [aba, setAba] = useState('abertas');
  const [dados, setDados] = useState(null);
  const [editando, setEditando] = useState(null);
  const [pagando, setPagando] = useState(null);
  const [recarregar, setRecarregar] = useState(0);
  const atualizar = () => setRecarregar(n => n + 1);

  useEffect(() => {
    let cancelado = false;
    api(`/contas-pagar${query({ status: aba })}`).then(({ ok, data }) => { if (ok && !cancelado) setDados(data); });
    return () => { cancelado = true; };
  }, [aba, versao, recarregar]);

  async function confirmarPagamento(corpo) {
    const { ok, data } = await api(`/contas-pagar/${pagando.id}/pagar`, { method: 'POST', body: corpo });
    if (!ok) return showToast(data?.error || 'Não foi possível pagar.', 'err');
    setPagando(null);
    showToast('Conta paga');
    invalidar(); // o gasto entra nos lançamentos, no resumo e nos saldos
  }

  async function desfazer(c) {
    const { ok, data } = await api(`/contas-pagar/${c.id}/desfazer`, { method: 'POST' });
    if (!ok) return showToast(data?.error || 'Não foi possível desfazer.', 'err');
    showToast('Pagamento desfeito', 'err');
    invalidar();
  }

  async function excluir(c) {
    const { ok, data } = await api(`/contas-pagar/${c.id}`, { method: 'DELETE' });
    if (!ok) return showToast(data?.error || 'Não foi possível excluir.', 'err');
    showToast('Conta removida', 'err');
    atualizar();
  }

  const t = dados?.totais;

  return (
    <div className="section-enter">
      <div className="page-header">
        <div>
          <div className="page-title">Contas a pagar</div>
          <div className="page-subtitle">Boletos e contas com vencimento, e o que já foi pago</div>
        </div>
        {t && (
          <div className="saldo-total">
            <small>Em aberto{t.qtd_atrasadas > 0 ? ` · ${t.qtd_atrasadas} atrasada${t.qtd_atrasadas > 1 ? 's' : ''}` : ''}</small>
            <strong className={t.atrasado > 0 ? 'neg' : ''}>{fmt(t.pendente + t.atrasado)}</strong>
          </div>
        )}
      </div>

      <ContaPagarForm editando={editando} onCancelar={() => setEditando(null)} onSalvo={() => { setEditando(null); atualizar(); }} />

      <div className="hist-wrap">
        <div className="card-head">
          <div className="card-title">Suas contas</div>
          <div className="abas" role="tablist">
            {ABAS.map(([id, rotulo]) => (
              <button key={id} role="tab" aria-selected={aba === id} className={`aba${aba === id ? ' ativa' : ''}`} onClick={() => setAba(id)}>{rotulo}</button>
            ))}
          </div>
        </div>

        {!dados ? <div className="empty">Carregando...</div> : dados.itens.length === 0 ? (
          <div className="empty">{aba === 'paga' ? 'Nenhuma conta paga ainda.' : aba === 'atrasada' ? 'Nenhuma conta atrasada. Bom trabalho!' : 'Nenhuma conta por aqui. Adicione a primeira acima.'}</div>
        ) : dados.itens.map(c => (
          <div key={c.id} className={`rec-card${editando?.id === c.id ? ' editing' : ''}`}>
            <div className="rec-left">
              <div>
                <div className="rec-name-text">{c.descricao}</div>
                <div className="rec-detail-text">
                  {c.cat} · vencimento {fmtDate(c.vencimento)}
                  {c.status === 'paga' ? ` · paga em ${fmtDate(c.pago_em)}` : ` · ${descreverPrazo(c.dias)}`}
                  {c.obs ? ` · ${c.obs}` : ''}
                </div>
              </div>
            </div>
            <div className="rec-right">
              <span className={`chip ${CLASSE[c.status]}`}>{ROTULO[c.status]}</span>
              <div className="rec-amount">{fmt(c.valor)}</div>
              {c.status === 'paga' ? (
                <button className="btn btn-sm" onClick={() => desfazer(c)}><Undo2 size={13} strokeWidth={2.5} /> Desfazer</button>
              ) : (
                <button className="btn btn-sm btn-primary" onClick={() => setPagando(c)}><CheckCircle2 size={13} strokeWidth={2.5} /> Pagar</button>
              )}
              <div className="hist-actions">
                {c.status !== 'paga' && (
                  <IconButton label="Editar" onClick={() => { setEditando(c); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Pencil size={13} strokeWidth={2} /></IconButton>
                )}
                <IconButton label="Excluir" danger onClick={() => excluir(c)}><Trash2 size={13} strokeWidth={2} /></IconButton>
              </div>
            </div>
          </div>
        ))}
      </div>

      {pagando && <PagarConta conta={pagando} onConfirmar={confirmarPagamento} onCancelar={() => setPagando(null)} />}
    </div>
  );
}
