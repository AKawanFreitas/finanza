import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';

// A região fica sempre no DOM: só assim o leitor de tela anuncia a mudança de texto.
export default function Toast() {
  const { toast, hideToast } = useFinance();
  const erro = toast.type === 'err';
  const Icone = erro ? AlertCircle : CheckCircle2;
  return (
    <div className="toast-regiao" role="status" aria-live="polite" aria-atomic="true">
      <div className={`toast${toast.visible ? ' show' : ''} ${toast.type}`}>
        <Icone size={18} strokeWidth={2.25} className="toast-icone" aria-hidden="true" />
        <span className="toast-msg">{toast.msg}</span>
        {toast.acao && toast.visible && (
          <button
            type="button" className="toast-acao"
            onClick={() => { toast.acao.onClick(); hideToast(); }}
          >
            {toast.acao.rotulo}
          </button>
        )}
      </div>
    </div>
  );
}
