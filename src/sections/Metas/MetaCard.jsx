import { useEffect, useState } from 'react';
import { Pencil, Trash2, Archive, ArchiveRestore, History, ArrowUpFromLine, ArrowDownToLine } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { api } from '../../utils/api';
import { fmt, fmtDate } from '../../utils/formatters';
import BarraOrcamento from '../../components/BarraOrcamento';
import IconButton from '../../components/IconButton';
import { useConfirm } from '../../components/Confirm';
import { lerValor } from '../../utils/valor';
import useEnvioUnico from '../../utils/useEnvioUnico';

const STATUS = {
  em_andamento: { rotulo: 'Em andamento', classe: '' },
  concluida: { rotulo: 'Meta atingida', classe: 'good' },
  atrasada: { rotulo: 'Prazo vencido', classe: 'bad' },
};

export default function MetaCard({ meta, onEditar, onMudou }) {
  const { showToast } = useFinance();
  const confirmar = useConfirm();
  const [valor, setValor] = useState('');
  const [aberto, setAberto] = useState(false);
  const [historico, setHistorico] = useState([]);
  const st = STATUS[meta.status];

  useEffect(() => {
    if (!aberto) return undefined;
    let cancelado = false;
    api(`/metas/${meta.id}/aportes`).then(({ ok, data }) => { if (ok && !cancelado) setHistorico(data); });
    return () => { cancelado = true; };
  }, [aberto, meta.id, meta.atual]);

  async function movimentar(tipo) {
    if (!(lerValor(valor) > 0)) return;
    const { ok, data } = await api(`/metas/${meta.id}/aportes`, { method: 'POST', body: { valor: lerValor(valor), tipo } });
    if (!ok) return showToast(data?.error || 'Não foi possível registrar.', 'err');
    showToast(tipo === 'aporte' ? 'Valor guardado' : 'Retirada registrada');
    setValor('');
    onMudou();
  }

  async function removerAporte(id) {
    if (!await confirmar({ titulo: 'Excluir este lançamento da meta?', mensagem: 'O valor guardado da meta será recalculado. Esta ação não pode ser desfeita.', rotulo: 'Excluir' })) return;
    const { ok, data } = await api(`/metas/${meta.id}/aportes/${id}`, { method: 'DELETE' });
    if (!ok) return showToast(data?.error || 'Não foi possível remover.', 'err');
    onMudou();
  }

  async function alternarArquivo() {
    const { ok, data } = await api(`/metas/${meta.id}`, {
      method: 'PUT', body: { nome: meta.nome, valor_alvo: meta.valor_alvo, prazo: meta.prazo, cor: meta.cor, arquivada: !meta.arquivada },
    });
    if (!ok) return showToast(data?.error || 'Não foi possível atualizar.', 'err');
    onMudou();
  }

  async function excluir() {
    if (!await confirmar({ titulo: `Excluir a meta “${meta.nome}”?`, mensagem: 'O histórico de aportes e retiradas também será excluído. Esta ação não pode ser desfeita.', rotulo: 'Excluir' })) return;
    const { ok, data } = await api(`/metas/${meta.id}`, { method: 'DELETE' });
    if (!ok) return showToast(data?.error || 'Não foi possível excluir.', 'err');
    showToast('Meta excluída');
    onMudou();
  }

  const [movimentarUmaVez, enviando] = useEnvioUnico(movimentar);

  return (
    <div className={`orc-linha meta-card${meta.arquivada ? ' arquivada' : ''}`} style={{ '--cor': meta.cor }}>
      <div className="orc-topo">
        <span className="dot" style={{ background: meta.cor }} />
        <strong>{meta.nome}</strong>
        {meta.arquivada && <span className="tag">arquivada</span>}
        <span className={`chip ${st.classe}`}>{st.rotulo}</span>
        <span className="orc-pct">{meta.percentual}%</span>
      </div>
      <BarraOrcamento item={{ cat: meta.nome, percentual: meta.percentual, status: 'ok' }} />
      <div className="orc-base">
        <span>
          {fmt(meta.atual)} de {fmt(meta.valor_alvo)}
          {meta.status !== 'concluida' && <> · faltam {fmt(meta.restante)}</>}
          {meta.prazo && <> · prazo {fmtDate(meta.prazo)}</>}
        </span>
        {meta.sugestao_mensal != null && (
          <span className="meta-sugestao">Guardar {fmt(meta.sugestao_mensal)}/mês ({meta.meses_restantes} {meta.meses_restantes === 1 ? 'mês' : 'meses'})</span>
        )}
      </div>

      <div className="meta-acoes">
        <span className="form-input-wrap has-text-prefix meta-valor">
          <span className="form-prefix-text">R$</span>
          <input className="form-control" type="text" inputMode="decimal" autoComplete="off" placeholder="0,00" aria-label={`Valor para ${meta.nome}`}
            value={valor} onChange={e => setValor(e.target.value)} onKeyDown={e => e.key === 'Enter' && movimentarUmaVez('aporte')} />
        </span>
        <button className="btn btn-sm btn-primary" disabled={enviando || !(lerValor(valor) > 0)} onClick={() => movimentarUmaVez('aporte')}><ArrowDownToLine size={13} strokeWidth={2.5} /> Guardar</button>
        <button className="btn btn-sm" disabled={enviando || !(lerValor(valor) > 0) || meta.atual <= 0} onClick={() => movimentarUmaVez('retirada')}><ArrowUpFromLine size={13} strokeWidth={2.5} /> Retirar</button>
        <span className="meta-icones">
          <IconButton label="Histórico" aria-expanded={aberto} onClick={() => setAberto(a => !a)}><History size={13} strokeWidth={2} /></IconButton>
          <IconButton label="Editar" onClick={() => onEditar(meta)}><Pencil size={13} strokeWidth={2} /></IconButton>
          <IconButton label={meta.arquivada ? 'Reativar' : 'Arquivar'} onClick={alternarArquivo}>
            {meta.arquivada ? <ArchiveRestore size={13} strokeWidth={2} /> : <Archive size={13} strokeWidth={2} />}
          </IconButton>
          <IconButton label="Excluir" danger onClick={excluir}><Trash2 size={13} strokeWidth={2} /></IconButton>
        </span>
      </div>

      {aberto && (
        <ul className="meta-historico">
          {historico.length === 0 ? <li className="muted">Nenhum aporte ainda.</li> : historico.map(a => (
            <li key={a.id}>
              <span>{fmtDate(a.data)}{a.obs ? ` · ${a.obs}` : ''}</span>
              <span className={a.tipo === 'aporte' ? 'pos' : 'neg'}>{a.tipo === 'aporte' ? '+' : '−'} {fmt(a.valor)}</span>
              <IconButton label="Excluir lançamento da meta" danger onClick={() => removerAporte(a.id)}><Trash2 size={12} strokeWidth={2} /></IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
