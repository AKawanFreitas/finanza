import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

const API = '/api';
const FinanceContext = createContext(null);

export function FinanceProvider({ children }) {
  const [transactions, setTransactions] = useState([]);
  const [recorrentes, setRecorrentes]   = useState([]);
  const [categorias, setCategorias]     = useState([]);
  const [loading, setLoading]           = useState(true);

  const [toast, setToast] = useState({ msg: '', type: 'ok', visible: false });
  const toastTimer = useRef(null);

  const showToast = useCallback((msg, type = 'ok') => {
    clearTimeout(toastTimer.current);
    setToast({ msg, type, visible: true });
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 2400);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/transactions`).then(r => r.json()),
      fetch(`${API}/recorrentes`).then(r => r.json()),
      fetch(`${API}/categorias`).then(r => r.json()),
    ]).then(([txs, recs, cats]) => {
      setTransactions(txs);
      setRecorrentes(recs);
      setCategorias(cats);
      setLoading(false);
    });
  }, []);

  async function addTransaction(data) {
    const res = await fetch(`${API}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const created = await res.json();
    setTransactions(prev => [...prev, created]);
    showToast(data.tipo === 'entrada' ? 'Receita adicionada ✓' : 'Gasto adicionado ✓');
  }

  async function delTransaction(id) {
    await fetch(`${API}/transactions/${id}`, { method: 'DELETE' });
    setTransactions(prev => prev.filter(t => t.id !== id));
    showToast('Removido', 'err');
  }

  async function addRecorrente(data) {
    const res = await fetch(`${API}/recorrentes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const created = await res.json();
    setRecorrentes(prev => [...prev, created]);
    showToast('Recorrente adicionado ✓');
  }

  async function delRecorrente(id) {
    await fetch(`${API}/recorrentes/${id}`, { method: 'DELETE' });
    setRecorrentes(prev => prev.filter(r => r.id !== id));
    showToast('Removido', 'err');
  }

  async function addCategoria(data) {
    const res = await fetch(`${API}/categorias`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const created = await res.json();
    setCategorias(prev => [...prev, created]);
    showToast('Categoria criada ✓');
  }

  async function delCategoria(id) {
    await fetch(`${API}/categorias/${id}`, { method: 'DELETE' });
    setCategorias(prev => prev.filter(c => c.id !== id));
    showToast('Categoria removida', 'err');
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#8b90a0', fontSize: '0.9rem' }}>
        Carregando...
      </div>
    );
  }

  return (
    <FinanceContext.Provider value={{
      transactions, recorrentes, categorias, toast,
      addTransaction, delTransaction,
      addRecorrente, delRecorrente,
      addCategoria, delCategoria,
    }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  return useContext(FinanceContext);
}
