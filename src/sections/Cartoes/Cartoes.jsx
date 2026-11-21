import { useEffect, useState } from 'react';
import { Pencil, Trash2, Archive, ArchiveRestore } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { api } from '../../utils/api';
import { fmt, fmtDate } from '../../utils/formatters';
import BarraOrcamento from '../../components/BarraOrcamento';
import CartaoForm from './CartaoForm';
import FaturaDetalhe from './FaturaDetalhe';
import { ROTULO_FATURA, CLASSE_FATURA, statusDeUso } from './status';

export default function Cartoes() {
  const { versao, invalidar, showToast } = useFinance();
  const [cartoes, setCartoes] = useState(null);
  const [selecionado, setSelecionado] = useState(null);
  const [editando, setEditando] = useState(null);

  useEffect(() => {
    let cancelado = false;
    api('/cartoes').then(({ ok, data }) => { if (ok && !cancelado) setCartoes(data); });
    return () => { cancelado = true; };
  }, [versao]);

  const ativoId = cartoes?.some(c => c.id === selecionado) ? selecionado : cartoes?.find(c => !c.arquivada)?.id ?? cartoes?.[0]?.id;
  const ativo = cartoes?.find(c => c.id === ativoId);

  async function alternarArquivo(c) {
    const corpo = {
      nome: c.nome, cor: c.cor, limite: c.limite, dia_fechamento: c.dia_fechamento, dia_vencimento: c.dia_vencimento,
      conta_pagamento_id: c.conta_pagamento_id, arquivada: !c.arquivada,
    };
    const { ok, data } = await api(`/cartoes/${c.id}`, { method: 'PUT', body: corpo });
    if (!ok) return showToast(data?.error || 'Não foi possível atualizar.', 'err');
    invalidar();
  }

  async function excluir(c) {
    const { ok, data } = await api(`/cartoes/${c.id}`, { method: 'DELETE' });
    if (!ok) return showToast(data?.error || 'Não foi possível excluir o cartão.', 'err');
    showToast('Cartão removido', 'err');
    invalidar();
  }

  return (
    <div className="section-enter">
      <div className="page-header">
        <div>
          <div className="page-title">Cartões</div>
          <div className="page-subtitle">Limite, faturas e parcelas dos seus cartões de crédito</div>
        </div>
      </div>

      <CartaoForm editando={editando} onCancelar={() => setEditando(null)} onSalvo={c => { setEditando(null); setSelecionado(c.id); invalidar(); }} />

      <div className="hist-wrap">
        <div className="card-head">
          <div className="card-title">Seus cartões</div>
          <div className="card-sub">{cartoes?.length ?? 0} {cartoes?.length === 1 ? 'cartão' : 'cartões'}</div>
        </div>
        {!cartoes ? <div className="empty">Carregando...</div> : cartoes.length === 0 ? (
          <div className="empty">Nenhum cartão ainda. Cadastre o primeiro acima para acompanhar limite e faturas.</div>
        ) : cartoes.map(c => {
          const f = c.fatura_atual;
          return (
            <div key={c.id} className={`cartao-linha${c.id === ativoId ? ' ativo' : ''}${c.arquivada ? ' arquivada' : ''}`}>
              <button className="cartao-corpo" onClick={() => setSelecionado(c.id)} aria-pressed={c.id === ativoId}>
                <div className="orc-topo">
                  <span className="dot" style={{ background: c.cor }} />
                  <strong>{c.nome}</strong>
                  {c.arquivada && <span className="tag">arquivado</span>}
                  <span className={`chip ${CLASSE_FATURA[f.status]}`}>Fatura {ROTULO_FATURA[f.status].toLowerCase()}</span>
                  <span className="orc-pct">{fmt(f.total)}</span>
                </div>
                <BarraOrcamento item={{ cat: c.nome, percentual: c.percentual_usado, status: statusDeUso(c.percentual_usado) }} />
                <div className="orc-base">
                  <span>{fmt(c.usado)} usados de {fmt(c.limite)} · disponível {fmt(c.disponivel)}</span>
                  <span>Fecha {fmtDate(f.fechamento).slice(0, 5)} · vence {fmtDate(f.vencimento).slice(0, 5)}</span>
                </div>
              </button>
              <div className="hist-actions">
                <button className="del-btn" title="Editar" onClick={() => { setEditando(c); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Pencil size={13} strokeWidth={2} /></button>
                <button className="del-btn" title={c.arquivada ? 'Reativar' : 'Arquivar'} onClick={() => alternarArquivo(c)}>
                  {c.arquivada ? <ArchiveRestore size={13} strokeWidth={2} /> : <Archive size={13} strokeWidth={2} />}
                </button>
                <button className="del-btn" title="Excluir (só cartões sem movimentações)" onClick={() => excluir(c)}><Trash2 size={13} strokeWidth={2} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {ativo && <FaturaDetalhe cartao={ativo} />}
    </div>
  );
}
