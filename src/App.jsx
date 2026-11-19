import { useState } from 'react';
import { FinanceProvider } from './context/FinanceContext';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import Dashboard from './sections/Dashboard/Dashboard';
import Lancamentos from './sections/Lancamentos/Lancamentos';
import Recorrentes from './sections/Recorrentes/Recorrentes';
import Categorias from './sections/Categorias/Categorias';

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                     'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const now = new Date();
const CURRENT_PERIOD = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

export default function App() {
  const [section, setSection] = useState('dashboard');
  const [period, setPeriod]   = useState(CURRENT_PERIOD);

  return (
    <FinanceProvider>
      <div className="layout">
        <Sidebar active={section} onNavigate={setSection} period={period} onPeriodChange={setPeriod} />
        <main className="main">
          {section === 'dashboard'   && <Dashboard period={period} />}
          {section === 'lancamento'  && <Lancamentos />}
          {section === 'recorrentes' && <Recorrentes />}
          {section === 'categorias'  && <Categorias />}
        </main>
      </div>
      <Toast />
    </FinanceProvider>
  );
}
