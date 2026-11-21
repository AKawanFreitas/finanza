import { useEffect, useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { api } from '../../utils/api';
import { fmt, fmtDate } from '../../utils/formatters';
import { MONTH_NAMES } from '../../utils/period';
import MonthStepper from '../../components/MonthStepper';
import Kpi from './Kpi';
import DailyBars from './DailyBars';
import MonthHistory from './MonthHistory';
import CategoryDonut from './CategoryDonut';
import MovementsTable from './MovementsTable';
import BarraOrcamento from '../../components/BarraOrcamento';

const HISTORY_MONTHS = 6;

// Variação em relação ao mês anterior, como chip. `goodWhenUp` define a cor.
function delta(atual, anterior, mesAnterior, goodWhenUp) {
  if (!anterior) return null;
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  if (pct === 0) return { text: `= ${mesAnterior}`, cls: 'neutral' };
  const up = pct > 0;
  return { text: `${up ? '▲' : '▼'} ${Math.abs(pct)}% vs. ${mesAnterior}`, cls: up === goodWhenUp ? 'good' : 'bad' };
}

export default function Dashboard({ ym, onYmChange, onNavigate }) {
  const { recorrentes, categorias, versao } = useFinance();
  const [resumo, setResumo] = useState(null);

  // Os números vêm prontos do servidor. Mantém o resumo anterior na tela enquanto o novo carrega.
  useEffect(() => {
    let cancelado = false;
    api(`/resumo?mes=${ym}`).then(({ ok, data }) => { if (ok && !cancelado) setResumo(data); });
    return () => { cancelado = true; };
  }, [ym, versao]);

  if (!resumo) return null;

  const rec = resumo.entradas, gas = resumo.saidas;
  const prevRec = resumo.anterior.entradas, prevGas = resumo.anterior.saidas;
  const history = resumo.historico.map(h => ({ ym: h.mes, rec: h.entradas, gas: h.saidas }));
  const sorted = resumo.porCategoria.map(c => [c.cat, c.valor]);
  const totalMes = resumo.qtd.total;
  const saldo = rec - gas;
  const [anoStr, mesStr] = ym.split('-');
  const mesNome     = MONTH_NAMES[Number(mesStr) - 1];
  const mesAnterior = MONTH_NAMES[(Number(mesStr) + 10) % 12].slice(0, 3).toLowerCase();
  const fixos       = recorrentes.filter(r => r.tipo === 'fixo');
  const fixosTotal  = fixos.reduce((a, r) => a + r.valor, 0);
  const spentPct    = rec > 0 ? Math.min(100, Math.round((gas / rec) * 100)) : null;
  const health = spentPct === null ? null
    : spentPct >= 90 ? { label: 'Atenção: gastos elevados', cls: 'bad' }
    : spentPct >= 70 ? { label: 'Moderado', cls: 'warn' }
    : { label: 'Saudável', cls: 'good' };

  return (
    <div style={{ opacity: resumo.mes === ym ? 1 : 0.5, transition: 'opacity .15s' }}>
      <header className="page-bar">
        <div>
          <h1 className="page-title">Resumo</h1>
          <p className="page-subtitle">{mesNome} de {anoStr}, {totalMes} {totalMes === 1 ? 'movimentação' : 'movimentações'}</p>
        </div>
        <MonthStepper ym={ym} onChange={onYmChange} />
      </header>

      <section className="kpis" aria-label="Indicadores do mês">
        <Kpi
          tone="brand" label="Saldo do mês" value={fmt(saldo)}
          chip={{ text: saldo >= 0 ? 'Superávit' : 'Déficit', cls: 'on-brand' }}
          note="Receitas menos gastos"
        />
        <Kpi
          label="Receitas" value={fmt(rec)}
          chip={delta(rec, prevRec, mesAnterior, true)}
          note={`${resumo.qtd.entradas} ${resumo.qtd.entradas === 1 ? 'entrada' : 'entradas'}`}
          spark={history.map(h => h.rec)}
        />
        <Kpi
          label="Gastos" value={fmt(gas)}
          chip={delta(gas, prevGas, mesAnterior, false)}
          note={`${resumo.qtd.saidas} ${resumo.qtd.saidas === 1 ? 'saída' : 'saídas'}`}
          spark={history.map(h => h.gas)}
        />
        <Kpi
          label="Contas fixas" value={fmt(fixosTotal)}
          note={`${fixos.length} ${fixos.length === 1 ? 'item' : 'itens'} por mês`}
        />
      </section>

      {totalMes === 0 ? (
        <section className="panel">
          <div className="panel-head"><h2>Nenhum lançamento em {mesNome.toLowerCase()}</h2></div>
          <div className="panel-body empty-state">
            <p>Registre uma entrada ou saída para ver os gráficos e a divisão por categoria deste mês.</p>
            <button className="btn btn-primary" onClick={() => onNavigate('lancamento')}>Adicionar lançamento</button>
          </div>
        </section>
      ) : (
        <div className="dash-grid">
          <div className="dash-col">
            <section className="panel">
              <div className="panel-head"><h2>Gastos por dia</h2></div>
              <div className="panel-body"><DailyBars days={resumo.porDia} ym={ym} /></div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Últimas movimentações</h2>
                {totalMes > 8 && <button className="link-btn" onClick={() => onNavigate('lancamento')}>Ver todas</button>}
              </div>
              <MovementsTable transactions={resumo.ultimas} categorias={categorias} />
            </section>
          </div>

          <div className="dash-col">
            <section className="panel">
              <div className="panel-head"><h2>Gastos por categoria</h2></div>
              <div className="panel-body"><CategoryDonut sorted={sorted} categorias={categorias} /></div>
            </section>

            {health && (
              <section className="panel">
                <div className="panel-head">
                  <h2>Comprometimento da renda</h2>
                  <span className={`chip ${health.cls}`}>{health.label}</span>
                </div>
                <div className="panel-body">
                  <div className="meter-big">{spentPct}%</div>
                  <div className="meter-track" role="img" aria-label={`${spentPct}% da receita foi gasta`}>
                    <div className={`meter-fill ${health.cls}`} style={{ width: `${spentPct}%` }} />
                  </div>
                  <p className="meter-note">da receita do mês já foi gasto</p>
                </div>
              </section>
            )}

            {resumo.vencimentos.length > 0 && (
              <section className="panel">
                <div className="panel-head">
                  <h2>Próximos vencimentos</h2>
                  <button className="link-btn" onClick={() => onNavigate('contas-pagar')}>Ver contas</button>
                </div>
                <ul className="venc-lista">
                  {resumo.vencimentos.map(v => (
                    <li key={v.chave}>
                      <button className="venc-item" onClick={() => onNavigate(v.tipo === 'fatura' ? 'cartoes' : 'contas-pagar')}>
                        <span className="venc-titulo">{v.titulo}</span>
                        <span className={`chip ${v.atrasada ? 'bad' : v.dias <= 3 ? 'warn' : ''}`}>
                          {v.atrasada ? `Atrasada ${-v.dias}d` : v.dias === 0 ? 'Hoje' : `${fmtDate(v.vencimento).slice(0, 5)}`}
                        </span>
                        <span className="venc-valor">{fmt(v.valor)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {resumo.orcamentos.length > 0 && (
              <section className="panel">
                <div className="panel-head">
                  <h2>Orçamentos</h2>
                  <button className="link-btn" onClick={() => onNavigate('orcamentos')}>Ver todos</button>
                </div>
                <div className="panel-body orc-mini">
                  {resumo.orcamentos.slice(0, 4).map(o => (
                    <div key={o.categoria_id} className="orc-mini-item">
                      <div className="orc-mini-topo">
                        <span><span className="dot" style={{ background: o.cor }} /> {o.cat}</span>
                        <span className={`orc-mini-pct ${o.status}`}>{o.percentual}%</span>
                      </div>
                      <BarraOrcamento item={o} />
                      <small>{fmt(o.gasto)} de {fmt(o.limite)}</small>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="panel">
              <div className="panel-head"><h2>Últimos {HISTORY_MONTHS} meses</h2></div>
              <div className="panel-body"><MonthHistory history={history} ym={ym} /></div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
