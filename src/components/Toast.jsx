import { useFinance } from '../context/FinanceContext';

export default function Toast() {
  const { toast } = useFinance();
  return (
    <div className={`toast${toast.visible ? ' show' : ''} ${toast.type}`}>
      {toast.msg}
    </div>
  );
}
