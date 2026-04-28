const NAV = [
  { id: 'dashboard',   icon: '📊', label: 'Dashboard' },
  { id: 'lancamento',  icon: '➕', label: 'Lançamentos' },
  { id: 'recorrentes', icon: '🔄', label: 'Recorrentes' },
  { id: 'categorias',  icon: '🏷️', label: 'Categorias' },
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

const PERIODS = getRecentPeriods();

export default function Sidebar({ active, onNavigate, period, onPeriodChange }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">
          <div className="logo-icon">F</div>
          <span className="logo-text">Finanza</span>
        </div>
      </div>

      <div className="sidebar-section-label">Menu</div>

      {NAV.map(item => (
        <button
          key={item.id}
          className={`nav-item${active === item.id ? ' active' : ''}`}
          onClick={() => onNavigate(item.id)}
        >
          <div className="nav-icon">{item.icon}</div>
          <span className="nav-label">{item.label}</span>
        </button>
      ))}

      <div className="sidebar-footer">
        <div className="period-label">Período</div>
        <select
          className="period-select"
          value={period}
          onChange={e => onPeriodChange(e.target.value)}
        >
          {PERIODS.map(p => <option key={p}>{p}</option>)}
        </select>
      </div>
    </aside>
  );
}
