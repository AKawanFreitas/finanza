import { LayoutDashboard, PlusCircle, RefreshCw, Tag } from 'lucide-react';
import Select from './Select';
import { useFinance } from '../context/FinanceContext';
import { periodOptions } from '../utils/period';

const NAV = [
  { id: 'dashboard',   Icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'lancamento',  Icon: PlusCircle,       label: 'Lançamentos' },
  { id: 'recorrentes', Icon: RefreshCw,         label: 'Recorrentes' },
  { id: 'categorias',  Icon: Tag,               label: 'Categorias' },
];

export default function Sidebar({ active, onNavigate, period, onPeriodChange }) {
  const { transactions } = useFinance();
  const periodOpts = periodOptions(transactions);

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
          options={periodOpts}
          dark
        />
      </div>
    </aside>
  );
}
