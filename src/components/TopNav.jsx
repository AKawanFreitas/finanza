import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ymToPeriod, shiftYM, currentYM } from '../utils/period';

const NAV = [
  { id: 'dashboard',   label: 'Resumo' },
  { id: 'lancamento',  label: 'Lançamentos' },
  { id: 'recorrentes', label: 'Recorrentes' },
  { id: 'categorias',  label: 'Categorias' },
];

export default function TopNav({ active, onNavigate, ym, onYmChange }) {
  const isCurrent = ym >= currentYM();

  return (
    <header className="topnav">
      <div className="topnav-inner">
        <button className="topnav-logo" onClick={() => onNavigate('dashboard')} aria-label="Finanza, ir para o resumo">
          <img src="/logo - finanza.png" alt="Finanza" />
        </button>

        <nav className="topnav-links" aria-label="Seções">
          {NAV.map(({ id, label }) => (
            <button
              key={id}
              className={`topnav-link${active === id ? ' active' : ''}`}
              aria-current={active === id ? 'page' : undefined}
              onClick={() => onNavigate(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="month-stepper" role="group" aria-label="Mês exibido no resumo">
          <button onClick={() => onYmChange(shiftYM(ym, -1))} aria-label="Mês anterior">
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
          <span className="month-stepper-label">{ymToPeriod(ym)}</span>
          <button onClick={() => onYmChange(shiftYM(ym, 1))} disabled={isCurrent} aria-label="Próximo mês">
            <ChevronRight size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
    </header>
  );
}
