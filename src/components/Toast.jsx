import { useFinance } from '../context/FinanceContext';

// A região fica sempre no DOM para que leitores de tela anunciem as mensagens novas.
export default function Toast() {
  const { toast } = useFinance();
  return (
    <div
      className={`toast${toast.visible ? ' show' : ''} ${toast.type}`}
      role={toast.type === 'err' ? 'alert' : 'status'}
      aria-live={toast.type === 'err' ? 'assertive' : 'polite'}
    >
      {toast.visible ? toast.msg : ''}
    </div>
  );
}
