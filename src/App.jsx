import { useState } from 'react';
import { FinanceProvider } from './context/FinanceContext';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import Dashboard from './sections/Dashboard/Dashboard';
import Lancamentos from './sections/Lancamentos/Lancamentos';
import Recorrentes from './sections/Recorrentes/Recorrentes';
import Categorias from './sections/Categorias/Categorias';
import { currentYM } from './utils/period';

export default function App() {
  const [section, setSection] = useState('dashboard');
  const [ym, setYm]           = useState(currentYM());

  return (
    <FinanceProvider>
      <div className="shell">
        <Sidebar active={section} onNavigate={setSection} />
        <main className="page">
          {section === 'dashboard'   && <Dashboard ym={ym} onYmChange={setYm} onNavigate={setSection} />}
          {section === 'lancamento'  && <Lancamentos />}
          {section === 'recorrentes' && <Recorrentes />}
          {section === 'categorias'  && <Categorias />}
        </main>
      </div>
      <Toast />
    </FinanceProvider>
  );
}
