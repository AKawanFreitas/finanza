import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ymToPeriod, shiftYM, currentYM } from '../utils/period';

export default function MonthStepper({ ym, onChange }) {
  const isCurrent = ym >= currentYM();

  return (
    <div className="month-stepper" role="group" aria-label="Mês exibido">
      <button onClick={() => onChange(shiftYM(ym, -1))} aria-label="Mês anterior">
        <ChevronLeft size={16} strokeWidth={2.25} />
      </button>
      <span className="month-stepper-label">{ymToPeriod(ym)}</span>
      <button onClick={() => onChange(shiftYM(ym, 1))} disabled={isCurrent} aria-label="Próximo mês">
        <ChevronRight size={16} strokeWidth={2.25} />
      </button>
    </div>
  );
}
