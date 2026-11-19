import { useState } from 'react';
import { Pencil, Trash2, ArrowDownLeft, ArrowUpRight, Search } from 'lucide-react';
import Select from '../../components/Select';
import { useFinance } from '../../context/FinanceContext';
import { fmt, fmtDate, getCatColor, catIcon } from '../../utils/formatters';

const NO_FILTERS = { busca: '', tipo: '', cat: '', mes: '' };

export default function TransactionList() {
  const { transactions, categorias, delTransaction, editing, setEditing } = useFinance();
  const [filters, setFilters] = useState(NO_FILTERS);
  const setFilter = (field, value) => setFilters(f => ({ ...f, [field]: value }));

  const query = filters.busca.trim().toLowerCase();
  const sorted = transactions
    .filter(t => !query || t.desc.toLowerCase().includes(query) || (t.obs || '').toLowerCase().includes(query))
    .filter(t => !filters.tipo || t.tipo === filters.tipo)
    .filter(t => !filters.cat  || t.cat === filters.cat)
    .filter(t => !filters.mes  || t.data.startsWith(filters.mes))
    .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);

  const hasFilters = Object.values(filters).some(Boolean);
  const saldo = sorted.reduce((sum, t) => sum + (t.tipo === 'entrada' ? t.valor : -t.valor), 0);

  const tipoOptions = [
    { value: '',        label: 'Todos os tipos' },
    { value: 'entrada', label: 'Entradas' },
    { value: 'saida',   label: 'Saídas' },
  ];
  const catOptions = [
    { value: '', label: 'Todas as categorias' },
    ...categorias.map(c => ({ value: c.nome, label: c.nome, color: c.cor })),
  ];

  return (
    <div className="hist-wrap">
      <div className="card-head" style={{ marginBottom: '0.75rem' }}>
        <div className="card-title">Histórico de lançamentos</div>
        <div className="card-sub">
          {sorted.length} {sorted.length === 1 ? 'registro' : 'registros'}
          {hasFilters && sorted.length > 0 && <> · saldo {saldo < 0 ? '-' : ''}{fmt(Math.abs(saldo))}</>}
        </div>
      </div>

      <div className="filters">
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
        <Select value={filters.tipo} onChange={v => setFilter('tipo', v)} options={tipoOptions} />
        <Select value={filters.cat}  onChange={v => setFilter('cat', v)}  options={catOptions} />
        <input
          className="form-control"
          type="month"
          aria-label="Filtrar por mês"
          value={filters.mes}
          onChange={e => setFilter('mes', e.target.value)}
        />
        {hasFilters && (
          <button className="btn btn-ghost" onClick={() => setFilters(NO_FILTERS)}>Limpar filtros</button>
        )}
      </div>

      <div className="hist-head">
        <div>Descrição</div>
        <div>Categoria</div>
        <div>Data</div>
        <div style={{ textAlign: 'right' }}>Valor</div>
        <div />
      </div>

      {sorted.length === 0 ? (
        <div className="empty">
          {hasFilters ? 'Nenhum lançamento corresponde aos filtros.' : 'Nenhum lançamento ainda. Use o formulário acima para adicionar o primeiro.'}
        </div>
      ) : sorted.map(t => {
        const CatIcon = catIcon(t.cat);
        const color   = getCatColor(categorias, t.cat);
        const isIn    = t.tipo === 'entrada';
        return (
          <div key={t.id} className={`hist-row ${editing?.id === t.id ? 'editing' : ''}`}>
            <div className="hist-desc-wrap">
              <div className="hist-mini-icon" style={{ background: color + '18', color }}>
                <CatIcon size={13} strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{t.desc}</div>
                {t.obs && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{t.obs}</div>}
              </div>
            </div>
            <div><span className="cat-badge">{t.cat}</span></div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{fmtDate(t.data)}</div>
            <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
              {isIn
                ? <ArrowDownLeft size={13} color="var(--green)" strokeWidth={2.5} />
                : <ArrowUpRight  size={13} color="var(--red)"   strokeWidth={2.5} />
              }
              <span style={{ fontSize: 13, fontWeight: 600, color: isIn ? 'var(--green)' : 'var(--red)' }}>
                {isIn ? '+' : '-'}{fmt(t.valor)}
              </span>
            </div>
            <div className="hist-actions">
              <button className="del-btn" onClick={() => { setEditing(t); window.scrollTo({ top: 0, behavior: 'smooth' }); }} title="Editar">
                <Pencil size={13} strokeWidth={2} />
              </button>
              <button className="del-btn" onClick={() => delTransaction(t.id)} title="Excluir">
                <Trash2 size={13} strokeWidth={2} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
