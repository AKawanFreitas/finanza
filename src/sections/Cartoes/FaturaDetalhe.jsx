import { useEffect, useState, useId } from 'react';
import { CreditCard as IconeCartao } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { api } from '../../utils/api';
import { fmt, fmtDate, today } from '../../utils/formatters';
import { MONTH_ABBR } from '../../utils/period';
import { ROTULO_FATURA, CLASSE_FATURA } from './status';

const rotuloMes = ym => `${MONTH_ABBR[Number(ym.slice(5)) - 1]}/${ym.slice(0, 4)}`;

export default function FaturaDetalhe({ cartao }) {
  const uid = useId();
  const { contas, versao, invalidar, showToast } = useFinance();
  const [faturas, setFaturas] = useState([]);
  const [mes, setMes] = useState(cartao.fatura_atual.mes);
  const [detalhe, setDetalhe] = useState(null);
  const [pagamento, setPagamento] = useState({ origem_id: '', valor: '', data: today() });
  const [pagando, setPagando] = useState(false);

  // Troca de cartão: volta para a fatura em curso.
  useEffect(() => { setMes(cartao.fatura_atual.mes); }, [cartao.id, cartao.fatura_atual.mes]);

  useEffect(() => {
    let cancelado = false;
    api(`/cartoes/${cartao.id}/faturas`).then(({ ok, data }) => { if (ok && !cancelado) setFaturas(data); });
    return () => { cancelado = true; };
  }, [cartao.id, versao]);

  useEffect(() => {
    let cancelado = false;
    api(`/cartoes/${cartao.id}/faturas/${mes}`).then(({ ok, data }) => { if (ok && !cancelado) setDetalhe(data); });
    return () => { cancelado = true; };
  }, [cartao.id, mes, versao]);

  const contasPagadoras = contas.filter(c => !c.arquivada && c.tipo !== 'cartao');
  const origem = pagamento.origem_id || cartao.conta_pagamento_id || contasPagadoras[0]?.id || '';
  const meses = [...new Set([cartao.fatura_atual.mes, ...faturas.map(f => f.mes)])].sort().reverse();

  async function pagar() {
    const valor = pagamento.valor === '' ? undefined : Number(pagamento.valor);
    setPagando(true);
    try {
      const { ok, data } = await api(`/cartoes/${cartao.id}/faturas/${mes}/pagar`, {
        method: 'POST', body: { origem_id: Number(origem), data: pagamento.data, ...(valor ? { valor } : {}) },
      });
      if (!ok) return showToast(data?.error || 'Não foi possível pagar a fatura.', 'err');
      showToast('Pagamento registrado');
      setPagamento(p => ({ ...p, valor: '' }));
      invalidar();
    } finally {
      setPagando(false);
    }
  }

  if (!detalhe) return <div className="hist-wrap"><div className="empty">Carregando fatura...</div></div>;
  const podePagar = detalhe.restante > 0 && contasPagadoras.length > 0;

  return (
    <div className="hist-wrap">
      <div className="card-head">
        <div>
          <div className="card-title">Fatura de {rotuloMes(detalhe.mes)} · {cartao.nome}</div>
          <div className="card-sub">Fecha em {fmtDate(detalhe.fechamento)} · vence em {fmtDate(detalhe.vencimento)}</div>
        </div>
        <select className="form-control fatura-mes" aria-label="Escolher fatura" value={mes} onChange={e => setMes(e.target.value)}>
          {meses.map(m => <option key={m} value={m}>{rotuloMes(m)}</option>)}
        </select>
      </div>

      <div className="fatura-resumo">
        <div><small>Total</small><strong>{fmt(detalhe.total)}</strong></div>
        <div><small>Pago</small><strong>{fmt(detalhe.pago)}</strong></div>
        <div><small>Falta pagar</small><strong>{fmt(detalhe.restante)}</strong></div>
        <span className={`chip ${CLASSE_FATURA[detalhe.status]}`}>{ROTULO_FATURA[detalhe.status]}</span>
      </div>

      {detalhe.lancamentos.length === 0 ? (
        <div className="empty">Nenhuma compra nesta fatura.</div>
      ) : (
        <table className="table">
          <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th className="num">Valor</th></tr></thead>
          <tbody>
            {detalhe.lancamentos.map(t => (
              <tr key={t.id}>
                <td className="muted">{fmtDate(t.data).slice(0, 5)}</td>
                <td className="strong">{t.desc}</td>
                <td className="muted">{t.cat}</td>
                <td className={`num strong ${t.tipo === 'entrada' ? 'pos' : ''}`}>{t.tipo === 'entrada' ? '+' : '−'} {fmt(t.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {detalhe.pagamentos.length > 0 && (
        <div className="fatura-pagamentos">
          <strong>Pagamentos</strong>
          {detalhe.pagamentos.map(p => <span key={p.id}>{fmtDate(p.data)} · {fmt(p.valor)} de {p.origem}</span>)}
        </div>
      )}

      {detalhe.restante > 0 && (
        <div className="fatura-pagar">
          <div className="form-group">
            <label className="form-label" htmlFor={`${uid}-1`}>Pagar com</label>
            <select id={`${uid}-1`} className="form-control" value={origem} onChange={e => setPagamento(p => ({ ...p, origem_id: Number(e.target.value) }))}>
              {contasPagadoras.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={`${uid}-2`}>Valor</label>
            <div className="form-input-wrap has-text-prefix">
              <span className="form-prefix-text">R$</span>
              <input id={`${uid}-2`} className="form-control" type="number" min="0" step="0.01" placeholder={String(detalhe.restante)} value={pagamento.valor}
                onChange={e => setPagamento(p => ({ ...p, valor: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={`${uid}-3`}>Data</label>
            <input id={`${uid}-3`} className="form-control" type="date" value={pagamento.data} onChange={e => setPagamento(p => ({ ...p, data: e.target.value }))} />
          </div>
          <button className="btn btn-primary" onClick={pagar} disabled={!podePagar || pagando}>
            <IconeCartao size={15} strokeWidth={2.5} /> {pagando ? 'Pagando...' : pagamento.valor ? 'Pagar parte' : 'Pagar fatura'}
          </button>
        </div>
      )}
    </div>
  );
}
