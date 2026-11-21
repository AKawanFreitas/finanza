import { useEffect, useState } from 'react';
import { Plus, Trash2, Check, Target } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { api } from '../../utils/api';
import { fmt } from '../../utils/formatters';
import { MONTH_NAMES } from '../../utils/period';
import MonthStepper from '../../components/MonthStepper';
import Select from '../../components/Select';
import BarraOrcamento from '../../components/BarraOrcamento';

const ROTULO_STATUS = { ok: 'Dentro do limite', atencao: 'Perto do limite', estourado: 'Limite estourado' };

function Linha({ item, onSalvar, onRemover }) {
  const [limite, setLimite] = useState(String(item.limite));
  useEffect(() => { setLimite(String(item.limite)); }, [item.limite]);
  const mudou = Number(limite) !== item.limite;

  return (
    <div className="orc-linha">
      <div className="orc-topo">
        <span className="dot" style={{ background: item.cor }} />
        <strong>{item.cat}</strong>
        <span className={`chip ${item.status === 'ok' ? 'good' : item.status === 'atencao' ? 'warn' : 'bad'}`}>
          {ROTULO_STATUS[item.status]}
        </span>
        <span className="orc-pct">{item.percentual}%</span>
      </div>
      <BarraOrcamento item={item} />
      <div className="orc-base">
        <span>
          {fmt(item.gasto)} de {fmt(item.limite)}
          {' · '}
          {item.restante >= 0 ? `restam ${fmt(item.restante)}` : <span className="orc-excesso">excedeu em {fmt(-item.restante)}</span>}
        </span>
        <span className="orc-editar">
          <span className="form-input-wrap has-text-prefix">
            <span className="form-prefix-text">R$</span>
            <input
              className="form-control" type="number" min="0" step="0.01" aria-label={`Limite de ${item.cat}`}
              value={limite} onChange={e => setLimite(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && mudou && onSalvar(item.categoria_id, Number(limite))}
            />
          </span>
          <button className="btn btn-sm" disabled={!mudou || !(Number(limite) > 0)} onClick={() => onSalvar(item.categoria_id, Number(limite))}>
            <Check size={13} strokeWidth={2.5} /> Salvar
          </button>
          <button className="del-btn" title="Remover orçamento" onClick={() => onRemover(item)}>
            <Trash2 size={13} strokeWidth={2} />
          </button>
        </span>
      </div>
    </div>
  );
}

export default function Orcamentos({ ym, onYmChange }) {
  const { categorias, versao, showToast } = useFinance();
  const [dados, setDados] = useState(null);
  const [recarregar, setRecarregar] = useState(0);
  const [novo, setNovo] = useState({ categoria_id: null, limite: '' });

  useEffect(() => {
    let cancelado = false;
    api(`/orcamentos?mes=${ym}`).then(({ ok, data }) => { if (ok && !cancelado) setDados(data); });
    return () => { cancelado = true; };
  }, [ym, versao, recarregar]);

  const comOrcamento = new Set((dados?.itens ?? []).map(i => i.categoria_id));
  const livres = categorias.filter(c => !comOrcamento.has(c.id));
  const escolhida = livres.some(c => c.id === novo.categoria_id) ? novo.categoria_id : livres[0]?.id;

  async function salvar(categoriaId, limite, mensagem = 'Orçamento salvo ✓') {
    const { ok, data } = await api(`/orcamentos/${categoriaId}`, { method: 'PUT', body: { limite } });
    if (!ok) return showToast(data?.error || 'Não foi possível salvar.', 'err');
    showToast(mensagem);
    setRecarregar(n => n + 1);
    return true;
  }

  async function adicionar() {
    if (!escolhida || !(Number(novo.limite) > 0)) return;
    if (await salvar(escolhida, Number(novo.limite), 'Orçamento criado ✓')) setNovo({ categoria_id: null, limite: '' });
  }

  async function remover(item) {
    const { ok, data } = await api(`/orcamentos/${item.categoria_id}`, { method: 'DELETE' });
    if (!ok) return showToast(data?.error || 'Não foi possível remover.', 'err');
    showToast('Orçamento removido', 'err');
    setRecarregar(n => n + 1);
  }

  const [ano, mes] = ym.split('-');

  return (
    <div className="section-enter">
      <header className="page-bar">
        <div>
          <h1 className="page-title">Orçamentos</h1>
          <p className="page-subtitle">Limite de gastos por categoria · {MONTH_NAMES[Number(mes) - 1]} de {ano}</p>
        </div>
        <MonthStepper ym={ym} onChange={onYmChange} />
      </header>

      <div className="form-wrap">
        <div className="form-header">
          <div className="form-header-text">
            <div className="form-header-title">Novo orçamento</div>
            <div className="form-header-sub">O limite vale para todos os meses. Avisamos por e-mail aos 80% e aos 100%.</div>
          </div>
        </div>
        {livres.length === 0 ? (
          <div className="empty">Todas as suas categorias já têm orçamento.</div>
        ) : (
          <>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Categoria</label>
                <Select
                  value={escolhida} onChange={v => setNovo(n => ({ ...n, categoria_id: v }))}
                  options={livres.map(c => ({ value: c.id, label: c.nome, color: c.cor }))}
                  prefix={<Target size={14} strokeWidth={2} />}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Limite mensal</label>
                <div className="form-input-wrap has-text-prefix">
                  <span className="form-prefix-text">R$</span>
                  <input
                    className="form-control" type="number" min="0" step="0.01" placeholder="0,00"
                    value={novo.limite} onChange={e => setNovo(n => ({ ...n, limite: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && adicionar()}
                  />
                </div>
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-primary btn-full" onClick={adicionar}>
                <Plus size={15} strokeWidth={2.5} /> Criar orçamento
              </button>
            </div>
          </>
        )}
      </div>

      <div className="hist-wrap">
        <div className="card-head">
          <div className="card-title">Acompanhamento do mês</div>
          {dados?.itens.length > 0 && (
            <div className="card-sub">{fmt(dados.totais.gasto)} de {fmt(dados.totais.limite)}</div>
          )}
        </div>
        {!dados ? (
          <div className="empty">Carregando...</div>
        ) : dados.itens.length === 0 ? (
          <div className="empty">Nenhum orçamento ainda. Crie o primeiro acima para acompanhar seus gastos.</div>
        ) : (
          dados.itens.map(item => <Linha key={item.categoria_id} item={item} onSalvar={salvar} onRemover={remover} />)
        )}
      </div>
    </div>
  );
}
