import { useState } from 'react';
import { Menu, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SECOES, SECAO_CONFIG, SECAO_ADMIN, agrupar } from '../nav';
import Modal from './Modal';

// O botão flutuante de novo lançamento só aparece onde não cobre formulários.
const COM_ATALHO = new Set(['dashboard', 'contas', 'cartoes', 'contas-pagar', 'orcamentos', 'metas']);

const iniciais = nome => nome.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();

export default function Sidebar({ active, onNavigate }) {
  const { user, ehAdmin } = useAuth();
  const [maisAberto, setMaisAberto] = useState(false);

  // A administração só aparece para o super admin.
  const secoes = ehAdmin ? [...SECOES, SECAO_ADMIN] : SECOES;
  const grupos = agrupar(secoes);
  const fixas = SECOES.filter(s => s.fixa);
  const noMais = [...secoes.filter(s => !s.fixa), SECAO_CONFIG];
  const maisAtivo = noMais.some(s => s.id === active);

  function ir(id) { setMaisAberto(false); onNavigate(id); }

  return (
    <>
      {/* Computador: menu lateral agrupado */}
      <aside className="sidebar">
        <button className="brand" onClick={() => onNavigate('dashboard')} aria-label="Finanza, ir para o resumo">
          <img src="/logo sem texto - finanza.png" alt="" />
          <span className="brand-text">
            <strong>Finanza</strong>
            <small>Controle financeiro inteligente</small>
          </span>
        </button>

        <nav className="side-nav" aria-label="Seções">
          {grupos.map(g => (
            <div key={g.nome} className="side-grupo" role="group" aria-label={g.nome}>
              <div className="side-grupo-nome" aria-hidden="true">{g.nome}</div>
              {g.itens.map(({ id, label, Icon }) => (
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
            </div>
          ))}
        </nav>

        <button
          className={`conta${active === 'configuracoes' ? ' active' : ''}`}
          onClick={() => onNavigate('configuracoes')}
          aria-current={active === 'configuracoes' ? 'page' : undefined}
          aria-label="Configurações da conta"
        >
          <span className="conta-avatar" aria-hidden="true">{iniciais(user.nome)}</span>
          <span className="conta-texto">
            <strong>{user.nome}</strong>
            <small>{user.email}</small>
          </span>
        </button>
      </aside>

      {/* Celular: 4 abas fixas + "Mais" */}
      <nav className="tabbar" aria-label="Seções">
        {fixas.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`tab${active === id ? ' active' : ''}`}
            aria-current={active === id ? 'page' : undefined}
            onClick={() => ir(id)}
          >
            <Icon size={22} strokeWidth={2} />
            <span>{label.replace('Contas a pagar', 'A pagar')}</span>
          </button>
        ))}
        <button
          className={`tab${maisAtivo ? ' active' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={maisAberto}
          onClick={() => setMaisAberto(true)}
        >
          <Menu size={22} strokeWidth={2} />
          <span>Mais</span>
        </button>
      </nav>

      {COM_ATALHO.has(active) && (
        <button className="fab" aria-label="Novo lançamento" onClick={() => onNavigate('lancamento', 'novo')}>
          <Plus size={26} strokeWidth={2.5} />
        </button>
      )}

      {maisAberto && (
        <Modal titulo="Mais seções" tituloId="titulo-mais" variante="folha" onFechar={() => setMaisAberto(false)}>
          <div className="mais-grade">
            {noMais.map(({ id, label, Icon }) => (
              <button key={id} className={`mais-item${active === id ? ' active' : ''}`} onClick={() => ir(id)}>
                <Icon size={22} strokeWidth={2} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="mais-conta">
            <span className="conta-avatar" aria-hidden="true">{iniciais(user.nome)}</span>
            <span className="conta-texto"><strong>{user.nome}</strong><small>{user.email}</small></span>
          </div>
        </Modal>
      )}
    </>
  );
}
