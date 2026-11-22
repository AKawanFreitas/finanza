import { useMemo, useRef, useState, useId } from 'react';
import { FileUp, Wallet, Check } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { api } from '../../utils/api';
import { fmt, fmtDate } from '../../utils/formatters';
import Select from '../../components/Select';

// Extratos brasileiros costumam vir em Windows-1252. Tenta UTF-8 e, se falhar, cai para ele.
async function lerTexto(arquivo) {
  const buf = await arquivo.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch { return new TextDecoder('windows-1252').decode(buf); }
}

const AVISO = { importada: 'Já importada', provavel: 'Possível duplicata' };

export default function Importar({ onNavigate }) {
  const uid = useId();
  const { contas, categorias, invalidar, showToast } = useFinance();
  const ativas = contas.filter(c => !c.arquivada);
  const [contaId, setContaId] = useState(ativas[0]?.id ?? null);
  const [arquivo, setArquivo] = useState(null);
  const [lendo, setLendo] = useState(false);
  const [previa, setPrevia] = useState(null);       // { formato, ignoradas, itens }
  const [marcados, setMarcados] = useState(new Set());
  const [cats, setCats] = useState([]);              // categoria escolhida por linha
  const [gravando, setGravando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const inputRef = useRef(null);

  const opcoesConta = ativas.map(c => ({ value: c.id, label: c.nome, color: c.cor }));

  function reiniciar() {
    setArquivo(null); setPrevia(null); setMarcados(new Set()); setCats([]); setResultado(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function ler() {
    if (!arquivo) return;
    setLendo(true);
    try {
      const conteudo = await lerTexto(arquivo);
      const { ok, data } = await api('/importacao/previa', { method: 'POST', body: { conta_id: contaId, conteudo } });
      if (!ok) return showToast(data?.error || 'Não foi possível ler o arquivo.', 'err');
      setPrevia(data);
      setCats(data.itens.map(i => i.categoria_id));
      // Duplicatas começam desmarcadas: a pessoa decide se quer importar mesmo assim.
      setMarcados(new Set(data.itens.flatMap((i, n) => (i.duplicada ? [] : [n]))));
    } finally {
      setLendo(false);
    }
  }

  async function importar() {
    const itens = [...marcados].sort((a, b) => a - b).map(n => ({ ...previa.itens[n], categoria_id: cats[n] }));
    setGravando(true);
    try {
      const { ok, data } = await api('/importacao/confirmar', { method: 'POST', body: { conta_id: contaId, itens } });
      if (!ok) return showToast(data?.error || 'Não foi possível importar.', 'err');
      setResultado(data);
      invalidar();
    } finally {
      setGravando(false);
    }
  }

  const totais = useMemo(() => {
    if (!previa) return null;
    let entradas = 0, saidas = 0;
    for (const n of marcados) {
      const i = previa.itens[n];
      if (i.tipo === 'entrada') entradas += i.valor; else saidas += i.valor;
    }
    return { entradas, saidas };
  }, [previa, marcados]);

  const alternar = n => setMarcados(m => {
    const novo = new Set(m);
    if (novo.has(n)) novo.delete(n); else novo.add(n);
    return novo;
  });

  return (
    <div className="section-enter">
      <div className="page-header">
        <div>
          <div className="page-title">Importar extrato</div>
          <div className="page-subtitle">Traga lançamentos do seu banco em OFX ou CSV</div>
        </div>
      </div>

      {resultado ? (
        <div className="panel">
          <div className="panel-body empty-state">
            <h2><Check size={18} strokeWidth={2.5} style={{ verticalAlign: '-3px', color: 'var(--green)' }} /> Importação concluída</h2>
            <p>
              {resultado.importados} {resultado.importados === 1 ? 'lançamento importado' : 'lançamentos importados'}
              {resultado.ignorados > 0 && <>, {resultado.ignorados} já existiam e foram ignorados</>}.
            </p>
            <div className="form-actions" style={{ padding: 0 }}>
              <button className="btn btn-primary" onClick={() => onNavigate('lancamento')}>Ver lançamentos</button>
              <button className="btn" onClick={reiniciar}>Importar outro arquivo</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="form-wrap">
          <div className="form-header">
            <div className="form-header-text">
              <div className="form-header-title">1. Escolha a conta e o arquivo</div>
              <div className="form-header-sub">OFX (extrato de conta ou cartão) ou CSV com colunas de data, descrição e valor</div>
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor={`${uid}-1`}>Conta de destino</label>
              <Select id={`${uid}-1`} value={contaId} onChange={setContaId} options={opcoesConta} prefix={<Wallet size={14} strokeWidth={2} />} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor={`${uid}-2`}>Arquivo</label>
              <input id={`${uid}-2`}
                ref={inputRef} className="form-control" type="file" accept=".ofx,.csv,.txt,text/csv"
                onChange={e => { setArquivo(e.target.files?.[0] ?? null); setPrevia(null); }}
              />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary btn-full" disabled={!arquivo || lendo} onClick={ler}>
              <FileUp size={15} strokeWidth={2.5} /> {lendo ? 'Lendo...' : 'Ler arquivo'}
            </button>
          </div>
        </div>
      )}

      {previa && !resultado && (
        <div className="hist-wrap">
          <div className="card-head">
            <div>
              <div className="card-title">2. Revise e confirme</div>
              <div className="card-sub">
                {previa.itens.length} lançamentos em {previa.formato.toUpperCase()}
                {previa.ignoradas > 0 && ` · ${previa.ignoradas} linhas ignoradas (sem data ou valor)`}
              </div>
            </div>
            <div className="import-bulk">
              <button className="link-btn" onClick={() => setMarcados(new Set(previa.itens.map((_, n) => n)))}>Marcar todos</button>
              <button className="link-btn" onClick={() => setMarcados(new Set())}>Desmarcar todos</button>
            </div>
          </div>

          <div className="import-scroll">
            <table className="table import-table">
              <thead>
                <tr>
                  <th />
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th className="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {previa.itens.map((i, n) => (
                  <tr key={i.externo} className={marcados.has(n) ? '' : 'desmarcada'}>
                    <td>
                      <input type="checkbox" aria-label={`Importar ${i.desc}`} checked={marcados.has(n)} onChange={() => alternar(n)} />
                    </td>
                    <td className="muted">{fmtDate(i.data).slice(0, 5)}</td>
                    <td className="strong">
                      {i.desc}
                      {i.duplicada && <span className={`chip warn import-aviso`}>{AVISO[i.duplicada]}</span>}
                    </td>
                    <td>
                      <select
                        className="form-control import-cat" value={cats[n] ?? ''} aria-label={`Categoria de ${i.desc}`}
                        onChange={e => setCats(c => c.map((v, k) => (k === n ? Number(e.target.value) : v)))}
                      >
                        {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </td>
                    <td className={`num strong ${i.tipo === 'entrada' ? 'pos' : ''}`}>
                      {i.tipo === 'entrada' ? '+' : '−'} {fmt(i.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="launch-bar import-rodape">
            <span>
              {marcados.size} selecionados · entradas {fmt(totais.entradas)} · saídas {fmt(totais.saidas)}
            </span>
            <button className="btn btn-primary" disabled={marcados.size === 0 || gravando} onClick={importar}>
              {gravando ? 'Importando...' : `Importar ${marcados.size} ${marcados.size === 1 ? 'lançamento' : 'lançamentos'}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
