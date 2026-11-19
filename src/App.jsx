import { useState } from 'react';
import { FinanceProvider } from './context/FinanceContext';
import TopNav from './components/TopNav';
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
      <TopNav active={section} onNavigate={setSection} ym={ym} onYmChange={setYm} />
      <main className="page">
        {section === 'dashboard'   && <Dashboard ym={ym} onNavigate={setSection} />}
        {section === 'lancamento'  && <Lancamentos />}
        {section === 'recorrentes' && <Recorrentes />}
        {section === 'categorias'  && <Categorias />}
      </main>
      <Toast />
    </FinanceProvider>
  );
}
