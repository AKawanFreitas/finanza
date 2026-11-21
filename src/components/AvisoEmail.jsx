import { useState } from 'react';
import { MailWarning } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFinance } from '../context/FinanceContext';

// Faixa no topo enquanto o e-mail não foi confirmado. O app continua utilizável.
export default function AvisoEmail() {
  const { user, reenviarVerificacao } = useAuth();
  const { showToast } = useFinance();
  const [enviando, setEnviando] = useState(false);

  if (user.email_verificado) return null;

  async function reenviar() {
    setEnviando(true);
    try {
      await reenviarVerificacao();
      showToast(`Enviamos um novo link para ${user.email} ✓`);
    } catch (err) {
      showToast(err.message, 'err');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="aviso-email" role="status">
      <MailWarning size={16} strokeWidth={2} />
      <span>Confirme seu e-mail (<strong>{user.email}</strong>) para receber alertas de orçamento e resumos.</span>
      <button className="link-btn" onClick={reenviar} disabled={enviando}>{enviando ? 'Enviando...' : 'Reenviar link'}</button>
    </div>
  );
}
