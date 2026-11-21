import { LayoutDashboard, ArrowLeftRight, Repeat, Tags, Settings, Shield, Wallet, FileUp, Target } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { id: 'dashboard',   label: 'Resumo',      Icon: LayoutDashboard },
  { id: 'lancamento',  label: 'Lançamentos', Icon: ArrowLeftRight },
  { id: 'contas',      label: 'Contas',      Icon: Wallet },
  { id: 'importar',    label: 'Importar',    Icon: FileUp },
  { id: 'orcamentos',  label: 'Orçamentos',  Icon: Target },
  { id: 'recorrentes', label: 'Recorrentes', Icon: Repeat },
  { id: 'categorias',  label: 'Categorias',  Icon: Tags },
];

const iniciais = nome => nome.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();

export default function Sidebar({ active, onNavigate }) {
  const { user, ehAdmin } = useAuth();

  // A administração só aparece para o super admin.
  const itens = ehAdmin ? [...NAV, { id: 'admin', label: 'Administração', Icon: Shield }] : NAV;

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
        {itens.map(({ id, label, Icon }) => (
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

      <button
        className={`conta${active === 'configuracoes' ? ' active' : ''}`}
        onClick={() => onNavigate('configuracoes')}
        aria-current={active === 'configuracoes' ? 'page' : undefined}
      >
        <span className="conta-avatar" aria-hidden="true">{iniciais(user.nome)}</span>
        <span className="conta-texto">
          <strong>{user.nome}</strong>
          <small>{user.email}</small>
        </span>
        <Settings size={16} strokeWidth={2} className="conta-engrenagem" />
      </button>
    </aside>
  );
}
