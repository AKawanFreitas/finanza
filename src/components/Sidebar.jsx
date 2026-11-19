import { LayoutDashboard, ArrowLeftRight, Repeat, Tags } from 'lucide-react';

const NAV = [
  { id: 'dashboard',   label: 'Resumo',      Icon: LayoutDashboard },
  { id: 'lancamento',  label: 'Lançamentos', Icon: ArrowLeftRight },
  { id: 'recorrentes', label: 'Recorrentes', Icon: Repeat },
  { id: 'categorias',  label: 'Categorias',  Icon: Tags },
];

export default function Sidebar({ active, onNavigate }) {
  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => onNavigate('dashboard')} aria-label="Finanza, ir para o resumo">
        <img src="/logo sem texto - finanza.png" alt="" />
        <span className="brand-text">
          <strong>Finanza</strong>
          <small>Controle financeiro inteligente</small>
        </span>
      </button>

      <nav className="side-nav" aria-label="Seções">
        {NAV.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`side-link${active === id ? ' active' : ''}`}
            aria-current={active === id ? 'page' : undefined}
            onClick={() => onNavigate(id)}
          >
            <Icon size={18} strokeWidth={2} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
