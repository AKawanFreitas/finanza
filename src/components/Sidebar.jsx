import { LayoutDashboard, PlusCircle, RefreshCw, Tag } from 'lucide-react';
import Select from './Select';

const NAV = [
  { id: 'dashboard',   Icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'lancamento',  Icon: PlusCircle,       label: 'Lançamentos' },
  { id: 'recorrentes', Icon: RefreshCw,         label: 'Recorrentes' },
  { id: 'categorias',  Icon: Tag,               label: 'Categorias' },
];

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                     'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function getRecentPeriods(n = 6) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  });
}

const PERIODS     = getRecentPeriods();
const PERIOD_OPTS = PERIODS.map(p => ({ value: p, label: p }));

export default function Sidebar({ active, onNavigate, period, onPeriodChange }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src="/logo - finanza.png"           alt="Finanza" className="logo-img" />
        <img src="/logo sem texto - finanza.png" alt="F"       className="logo-icon-img" />
      </div>

      <div className="sidebar-section-label">Menu</div>

      {NAV.map(({ id, Icon, label }) => (
        <button
          key={id}
          className={`nav-item${active === id ? ' active' : ''}`}
          onClick={() => onNavigate(id)}
        >
          <div className="nav-icon">
            <Icon size={16} strokeWidth={2} />
          </div>
          <span className="nav-label">{label}</span>
        </button>
      ))}

      <div className="sidebar-footer">
        <div className="period-label">Período</div>
        <Select
          value={period}
          onChange={onPeriodChange}
          options={PERIOD_OPTS}
          dark
        />
      </div>
    </aside>
  );
}
