import { useState } from 'react';
import { LayoutDashboard, ArrowLeftRight, Repeat, Tags, Settings, Shield, Wallet, FileUp, Target, CreditCard, PiggyBank, CalendarCheck, Menu, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Modal from './Modal';

const NAV = [
  { id: 'dashboard',   label: 'Resumo',      Icon: LayoutDashboard },
  { id: 'lancamento',  label: 'Lançamentos', Icon: ArrowLeftRight },
  { id: 'contas',      label: 'Contas',      Icon: Wallet },
  { id: 'contas-pagar', label: 'Contas a pagar', Icon: CalendarCheck },
  { id: 'cartoes',     label: 'Cartões',     Icon: CreditCard },
  { id: 'importar',    label: 'Importar',    Icon: FileUp },
  { id: 'orcamentos',  label: 'Orçamentos',  Icon: Target },
  { id: 'metas',       label: 'Metas',       Icon: PiggyBank },
  { id: 'recorrentes', label: 'Recorrentes', Icon: Repeat },
  { id: 'categorias',  label: 'Categorias',  Icon: Tags },
];

// No celular a barra inferior mostra só o que se usa todo dia; o resto abre em "Mais".
const PRINCIPAIS = ['dashboard', 'lancamento', 'contas-pagar'];

const iniciais = nome => nome.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();

export default function Sidebar({ active, onNavigate, recolhida = false, onAlternar }) {
  const { user, ehAdmin, sair } = useAuth();
  const [maisAberto, setMaisAberto] = useState(false);

  // A administração só aparece para o super admin.
  const itens = ehAdmin ? [...NAV, { id: 'admin', label: 'Administração', Icon: Shield }] : NAV;
  const principais = itens.filter(i => PRINCIPAIS.includes(i.id));
  const extras = [...itens.filter(i => !PRINCIPAIS.includes(i.id)), { id: 'configuracoes', label: 'Configurações', Icon: Settings }];
  const maisAtivo = extras.some(i => i.id === active);

  const ir = id => { setMaisAberto(false); onNavigate(id); };

  return (
    <>
      <aside className="sidebar">
        <div className="side-topo">
          <button className="brand" onClick={() => onNavigate('dashboard')} aria-label="Finanza, ir para o resumo" title={recolhida ? 'Finanza' : undefined}>
            <img src="/logo sem texto - finanza.png" alt="" />
            <span className="brand-text">
              <strong>Finanza</strong>
            </span>
          </button>
          <button
            className="side-recolher" onClick={onAlternar}
            aria-label={recolhida ? 'Expandir menu' : 'Recolher menu'} aria-expanded={!recolhida}
            title={recolhida ? 'Expandir menu' : 'Recolher menu'}
          >
            {recolhida ? <PanelLeftOpen size={18} strokeWidth={2} /> : <PanelLeftClose size={18} strokeWidth={2} />}
          </button>
        </div>

        <nav className="side-nav" aria-label="Seções">
          {itens.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`side-link${active === id ? ' active' : ''}`}
              aria-current={active === id ? 'page' : undefined}
              aria-label={recolhida ? label : undefined}
              title={recolhida ? label : undefined}
              onClick={() => onNavigate(id)}
            >
              <Icon size={20} strokeWidth={2} />
              <span className="side-rotulo">{label}</span>
            </button>
          ))}
        </nav>

        <div className="conta-bloco">
          <button
            className={`conta${active === 'configuracoes' ? ' active' : ''}`}
            onClick={() => onNavigate('configuracoes')}
            aria-current={active === 'configuracoes' ? 'page' : undefined}
            title={recolhida ? `${user.nome} · Configurações` : undefined}
          >
            <span className="conta-avatar" aria-hidden="true">{iniciais(user.nome)}</span>
            <span className="conta-texto">
              <strong>{user.nome}</strong>
              <small>{user.email}</small>
            </span>
          </button>
          <button className="conta-sair" onClick={sair} aria-label="Sair da conta" title="Sair">
            <LogOut size={18} strokeWidth={2} />
          </button>
        </div>
      </aside>

      <nav className="bottom-nav" aria-label="Seções">
        {principais.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`bottom-link${active === id ? ' active' : ''}`}
            aria-current={active === id ? 'page' : undefined}
            onClick={() => ir(id)}
          >
            <Icon size={22} strokeWidth={2} />
            <span>{id === 'contas-pagar' ? 'A pagar' : label}</span>
          </button>
        ))}
        <button
          className={`bottom-link${maisAtivo ? ' active' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={maisAberto}
          onClick={() => setMaisAberto(true)}
        >
          <Menu size={22} strokeWidth={2} />
          <span>Mais</span>
        </button>
      </nav>

      {maisAberto && (
        <Modal folha titulo="Mais seções" onFechar={() => setMaisAberto(false)}>
          <ul className="folha-lista">
            {extras.map(({ id, label, Icon }) => (
              <li key={id}>
                <button
                  className={`folha-item${active === id ? ' active' : ''}`}
                  aria-current={active === id ? 'page' : undefined}
                  onClick={() => ir(id)}
                >
                  <Icon size={20} strokeWidth={2} />
                  {label}
                </button>
              </li>
            ))}
          </ul>
          <p className="folha-conta"><small>{user.nome} · {user.email}</small></p>
          <button className="folha-item folha-sair" onClick={sair}>
            <LogOut size={20} strokeWidth={2} />
            Sair da conta
          </button>
        </Modal>
      )}
    </>
  );
}
