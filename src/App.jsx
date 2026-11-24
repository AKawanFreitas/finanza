import { useState } from 'react';
import { FinanceProvider } from './context/FinanceContext';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import { ConfirmProvider } from './components/Confirm';
import Entrar from './sections/Auth/Entrar';
import AcaoPorLink from './sections/Auth/AcaoPorLink';
import { lerAcaoDaUrl } from './utils/acaoDaUrl';
import AvisoEmail from './components/AvisoEmail';
import SuporteBarra from './components/SuporteBarra';
import TrocarSenha from './sections/Auth/TrocarSenha';
import Dashboard from './sections/Dashboard/Dashboard';
import Lancamentos from './sections/Lancamentos/Lancamentos';
import Contas from './sections/Contas/Contas';
import Importar from './sections/Importar/Importar';
import Cartoes from './sections/Cartoes/Cartoes';
import Metas from './sections/Metas/Metas';
import ContasPagar from './sections/ContasPagar/ContasPagar';
import Orcamentos from './sections/Orcamentos/Orcamentos';
import Recorrentes from './sections/Recorrentes/Recorrentes';
import Categorias from './sections/Categorias/Categorias';
import Configuracoes from './sections/Configuracoes/Configuracoes';
import Admin from './sections/Admin/Admin';
import { currentYM } from './utils/period';

export default function App() {
  const { user, carregando } = useAuth();
  const [acao, setAcao] = useState(lerAcaoDaUrl);

  // Links de e-mail (redefinir senha, confirmar e-mail) abrem antes de qualquer outra tela.
  if (acao) return <AcaoPorLink acao={acao} onConcluir={() => setAcao(null)} />;
  if (carregando) return <div className="tela-carregando">Carregando...</div>;
  if (!user) return <Entrar />;
  if (user.trocar_senha) return <TrocarSenha />;

  // A chave recomeça a navegação e os dados a cada troca de conta.
  return <AppLogado key={user.id} />;
}

const CHAVE_MENU = 'finanza.menu-recolhido';
const lerMenuRecolhido = () => {
  try { return localStorage.getItem(CHAVE_MENU) === '1'; } catch { return false; }
};

function AppLogado() {
  const { ehAdmin, user } = useAuth();
  const [section, setSection] = useState('dashboard');
  const [ym, setYm] = useState(currentYM());
  const [recolhida, setRecolhida] = useState(lerMenuRecolhido);

  function alternarMenu() {
    setRecolhida(r => {
      try { localStorage.setItem(CHAVE_MENU, r ? '0' : '1'); } catch { /* sem armazenamento: vale só nesta sessão */ }
      return !r;
    });
  }

  return (
    <FinanceProvider>
      <ConfirmProvider>
      {user.suporte && <SuporteBarra />}
      <div className={`shell${recolhida ? ' recolhida' : ''}${user.suporte ? ' com-suporte' : ''}`}>
        <Sidebar active={section} onNavigate={setSection} recolhida={recolhida} onAlternar={alternarMenu} />
        <main className="page">
          <AvisoEmail />
          {section === 'dashboard'     && <Dashboard ym={ym} onYmChange={setYm} onNavigate={setSection} />}
          {section === 'lancamento'    && <Lancamentos />}
          {section === 'contas'        && <Contas />}
          {section === 'contas-pagar'  && <ContasPagar />}
          {section === 'cartoes'       && <Cartoes />}
          {section === 'importar'      && <Importar onNavigate={setSection} />}
          {section === 'metas'         && <Metas />}
          {section === 'orcamentos'    && <Orcamentos ym={ym} onYmChange={setYm} />}
          {section === 'recorrentes'   && <Recorrentes />}
          {section === 'categorias'    && <Categorias />}
          {section === 'configuracoes' && <Configuracoes />}
          {section === 'admin'         && (ehAdmin ? <Admin /> : <Configuracoes />)}
        </main>
      </div>
      <Toast />
      </ConfirmProvider>
    </FinanceProvider>
  );
}
