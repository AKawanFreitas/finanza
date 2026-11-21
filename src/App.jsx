import { useState } from 'react';
import { FinanceProvider } from './context/FinanceContext';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import Entrar from './sections/Auth/Entrar';
import TrocarSenha from './sections/Auth/TrocarSenha';
import Dashboard from './sections/Dashboard/Dashboard';
import Lancamentos from './sections/Lancamentos/Lancamentos';
import Contas from './sections/Contas/Contas';
import Importar from './sections/Importar/Importar';
import Recorrentes from './sections/Recorrentes/Recorrentes';
import Categorias from './sections/Categorias/Categorias';
import Configuracoes from './sections/Configuracoes/Configuracoes';
import Admin from './sections/Admin/Admin';
import { currentYM } from './utils/period';

export default function App() {
  const { user, carregando } = useAuth();

  if (carregando) return <div className="tela-carregando">Carregando...</div>;
  if (!user) return <Entrar />;
  if (user.trocar_senha) return <TrocarSenha />;

  // A chave recomeça a navegação e os dados a cada troca de conta.
  return <AppLogado key={user.id} />;
}

function AppLogado() {
  const { ehAdmin } = useAuth();
  const [section, setSection] = useState('dashboard');
  const [ym, setYm] = useState(currentYM());

  return (
    <FinanceProvider>
      <div className="shell">
        <Sidebar active={section} onNavigate={setSection} />
        <main className="page">
          {section === 'dashboard'     && <Dashboard ym={ym} onYmChange={setYm} onNavigate={setSection} />}
          {section === 'lancamento'    && <Lancamentos />}
          {section === 'contas'        && <Contas />}
          {section === 'importar'      && <Importar onNavigate={setSection} />}
          {section === 'recorrentes'   && <Recorrentes />}
          {section === 'categorias'    && <Categorias />}
          {section === 'configuracoes' && <Configuracoes />}
          {section === 'admin'         && (ehAdmin ? <Admin /> : <Configuracoes />)}
        </main>
      </div>
      <Toast />
    </FinanceProvider>
  );
}
