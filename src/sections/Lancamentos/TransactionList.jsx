import { useEffect, useRef, useState } from 'react';
import { Pencil, Trash2, Search, ChevronLeft, ChevronRight, Download, ListChecks } from 'lucide-react';
import CategoriaIcone from '../../components/CategoriaIcone';
import Select from '../../components/Select';
import ExcluirParcelas from '../../components/ExcluirParcelas';
import { useFinance } from '../../context/FinanceContext';
import { api, query } from '../../utils/api';
import { fmt, fmtDate, getCatColor } from '../../utils/formatters';
import IconButton from '../../components/IconButton';

const NO_FILTERS = { busca: '', tipo: '', categoria_id: '', conta_id: '', mes: '' };
const POR_PAGINA = 20;

export default function TransactionList() {
  const { categorias, contas, versao, delTransaction, editing, setEditing, ocultos } = useFinance();
  const [filters, setFilters] = useState(NO_FILTERS);
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');
  const pedido = useRef(0);
  const buscaRef = useRef('');
  const [excluindo, setExcluindo] = useState(null); // lançamento parcelado aguardando a escolha

  const setFilter = (field, value) => {
    setFilters(f => ({ ...f, [field]: value }));
    if (field !== 'busca') setPagina(1);
  };

  // A busca por texto espera a pessoa parar de digitar antes de ir ao servidor.
  // Só volta à página 1 se o texto realmente mudou (senão o timer de abertura desfaria a navegação).
  useEffect(() => {
    const t = setTimeout(() => {
      const novo = filters.busca.trim();
      if (novo === buscaRef.current) return;
      buscaRef.current = novo;
      setBuscaAplicada(novo);
      setPagina(1);
    }, 300);
    return () => clearTimeout(t);
  }, [filters.busca]);

  useEffect(() => {
    const id = ++pedido.current;
    api(`/transactions${query({
      q: buscaAplicada, tipo: filters.tipo, categoria_id: filters.categoria_id,
      conta_id: filters.conta_id, mes: filters.mes, pagina, limite: POR_PAGINA,
    })}`).then(({ ok, data }) => {
      if (id !== pedido.current) return; // chegou uma resposta mais nova, esta é descartada
      if (!ok) return setErro(data?.error || 'Não foi possível carregar os lançamentos.');
      setErro('');
      setResultado(data);
      if (data.pagina !== pagina) setPagina(data.pagina); // a página saiu do intervalo (ex.: apagou o último item dela)
    });
  }, [buscaAplicada, filters.tipo, filters.categoria_id, filters.conta_id, filters.mes, pagina, versao]);

  // Exporta tudo o que o filtro atual mostra (não só a página). O download usa o cookie de sessão.
  const urlExportacao = formato => `/api/exportacao/lancamentos${query({
    formato, q: buscaAplicada, tipo: filters.tipo, categoria_id: filters.categoria_id,
    conta_id: filters.conta_id, mes: filters.mes,
  })}`;

  const iconeCat = nome => categorias.find(c => c.nome === nome)?.icone;
  const hasFilters = Object.values(filters).some(Boolean);
  const itens = (resultado?.itens ?? []).filter(t => !ocultos.has(t.id));
  const total = resultado?.total ?? 0;
  const saldo = resultado?.totais.saldo ?? 0;

  const tipoOptions = [
    { value: '',        label: 'Todos os tipos' },
    { value: 'entrada', label: 'Entradas' },
    { value: 'saida',   label: 'Saídas' },
  ];
  const catOptions = [
    { value: '', label: 'Todas as categorias' },
    ...categorias.map(c => ({ value: String(c.id), label: c.nome, color: c.cor, icone: c.icone })),
  ];
  const contaOptions = [
    { value: '', label: 'Todas as contas' },
    ...contas.map(c => ({ value: String(c.id), label: c.arquivada ? `${c.nome} (arquivada)` : c.nome, color: c.cor })),
  ];

  return (
    <div className="hist-wrap">
      <div className="card-head">
        <div className="card-title"><ListChecks size={20} />Histórico de lançamentos</div>
        <div className="card-sub">
          {total} {total === 1 ? 'registro' : 'registros'}
          {hasFilters && total > 0 && <> · saldo {saldo < 0 ? '-' : ''}{fmt(Math.abs(saldo))}</>}
          {total > 0 && (
            <span className="exportar">
              <Download size={12} strokeWidth={2.5} />
              <a href={urlExportacao('csv')} download>CSV</a>
              <a href={urlExportacao('xlsx')} download>Excel</a>
            </span>
          )}
        </div>
      </div>

      <div className="filters filters-4">
        <div className="form-input-wrap filters-search">
          <span className="form-prefix"><Search size={14} strokeWidth={2} /></span>
          <input
            className="form-control"
            placeholder="Buscar por descrição ou observação"
            aria-label="Buscar lançamentos"
            value={filters.busca}
            onChange={e => setFilter('busca', e.target.value)}
          />
        </div>
        <Select value={filters.tipo} onChange={v => setFilter('tipo', v)} options={tipoOptions} aria-label="Filtrar por tipo" />
        <Select value={filters.categoria_id} onChange={v => setFilter('categoria_id', v)} options={catOptions} aria-label="Filtrar por categoria" />
        <Select value={filters.conta_id} onChange={v => setFilter('conta_id', v)} options={contaOptions} aria-label="Filtrar por conta" />
        <input
          className="form-control"
          type="month"
          aria-label="Filtrar por mês"
          value={filters.mes}
          onChange={e => setFilter('mes', e.target.value)}
        />
        {hasFilters && (
          <button className="btn btn-ghost" onClick={() => { setFilters(NO_FILTERS); setPagina(1); }}>Limpar filtros</button>
        )}
      </div>

      <div className="hist-head">
        <div>Descrição</div>
        <div>Categoria</div>
        <div>Data</div>
        <div style={{ textAlign: 'right' }}>Valor</div>
        <div />
      </div>

      {erro ? (
        <div className="empty">{erro}</div>
      ) : !resultado ? (
        <div className="empty">Carregando...</div>
      ) : itens.length === 0 ? (
        <div className="empty">
          {hasFilters ? 'Nenhum lançamento corresponde aos filtros.' : 'Nenhum lançamento ainda. Use o formulário acima para adicionar o primeiro.'}
        </div>
      ) : itens.map(t => {
        const color = getCatColor(categorias, t.cat);
        const isIn  = t.tipo === 'entrada';
        return (
          <div key={t.id} className={`hist-row ${editing?.id === t.id ? 'editing' : ''}`}>
            <div className="hist-desc-wrap">
              <CategoriaIcone icone={iconeCat(t.cat)} cor={color} tam={34} />
              <div>
                <div className="hist-desc">{t.desc}</div>
                <div className="hist-obs">{[t.conta, t.fatura && `fatura ${t.fatura.slice(5)}/${t.fatura.slice(0, 4)}`, t.obs].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
            <div><span className="cat-badge">{t.cat}</span></div>
            <div className="hist-date">{fmtDate(t.data)}</div>
            <div className={`tx-amount ${isIn ? 'in' : ''}`} style={{ justifyContent: 'flex-end' }}>
              {isIn ? '+' : '−'} {fmt(t.valor)}
            </div>
            <div className="hist-actions">
              <IconButton label="Editar" onClick={() => { setEditing(t); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                <Pencil size={13} strokeWidth={2} />
              </IconButton>
              <IconButton label="Excluir" danger onClick={() => (t.parcela ? setExcluindo(t) : delTransaction(t.id))}>
                <Trash2 size={13} strokeWidth={2} />
              </IconButton>
            </div>
          </div>
        );
      })}

      {excluindo && (
        <ExcluirParcelas
          lancamento={excluindo}
          onCancelar={() => setExcluindo(null)}
          onEscolher={modo => { delTransaction(excluindo.id, modo); setExcluindo(null); }}
        />
      )}

      {resultado && resultado.paginas > 1 && (
        <nav className="pager" aria-label="Paginação">
          <button className="btn btn-sm" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>
            <ChevronLeft size={14} strokeWidth={2} /> Anterior
          </button>
          <span>Página {resultado.pagina} de {resultado.paginas}</span>
          <button className="btn btn-sm" disabled={pagina >= resultado.paginas} onClick={() => setPagina(p => p + 1)}>
            Próxima <ChevronRight size={14} strokeWidth={2} />
          </button>
        </nav>
      )}
    </div>
  );
}
