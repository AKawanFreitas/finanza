import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

const API = '/api';
const FinanceContext = createContext(null);

export function FinanceProvider({ children }) {
  const [transactions, setTransactions] = useState([]);
  const [recorrentes, setRecorrentes]   = useState([]);
  const [categorias, setCategorias]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [editing, setEditing]           = useState(null);
  const [editingRec, setEditingRec]     = useState(null);
  const [editingCat, setEditingCat]     = useState(null);

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

  async function sendJson(url, method, data) {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) {
      showToast(body.error || 'Não foi possível salvar.', 'err');
      return null;
    }
    return body;
  }

  async function addTransaction(data, { silent = false } = {}) {
    const created = await sendJson(`${API}/transactions`, 'POST', data);
    if (!created) return false;
    setTransactions(prev => [...prev, created]);
    if (!silent) showToast(data.tipo === 'entrada' ? 'Receita adicionada ✓' : 'Gasto adicionado ✓');
    return true;
  }

  async function updateTransaction(id, data) {
    const updated = await sendJson(`${API}/transactions/${id}`, 'PUT', data);
    if (!updated) return false;
    setTransactions(prev => prev.map(t => (t.id === id ? updated : t)));
    showToast('Lançamento atualizado ✓');
    return true;
  }

  async function delTransaction(id) {
    await fetch(`${API}/transactions/${id}`, { method: 'DELETE' });
    setTransactions(prev => prev.filter(t => t.id !== id));
    setEditing(e => (e?.id === id ? null : e));
    showToast('Removido', 'err');
  }

  async function addRecorrente(data) {
    const created = await sendJson(`${API}/recorrentes`, 'POST', data);
    if (!created) return false;
    setRecorrentes(prev => [...prev, created]);
    showToast('Recorrente adicionado ✓');
    return true;
  }

  async function updateRecorrente(id, data) {
    const updated = await sendJson(`${API}/recorrentes/${id}`, 'PUT', data);
    if (!updated) return false;
    setRecorrentes(prev => prev.map(r => (r.id === id ? updated : r)));
    showToast('Recorrente atualizado ✓');
    return true;
  }

  async function delRecorrente(id) {
    await fetch(`${API}/recorrentes/${id}`, { method: 'DELETE' });
    setRecorrentes(prev => prev.filter(r => r.id !== id));
    setEditingRec(e => (e?.id === id ? null : e));
    showToast('Removido', 'err');
  }

  async function addCategoria(data) {
    const created = await sendJson(`${API}/categorias`, 'POST', data);
    if (!created) return false;
    setCategorias(prev => [...prev, created]);
    showToast('Categoria criada ✓');
    return true;
  }

  async function updateCategoria(id, data) {
    const updated = await sendJson(`${API}/categorias/${id}`, 'PUT', data);
    if (!updated) return false;
    const antigo = categorias.find(c => c.id === id)?.nome;
    setCategorias(prev => prev.map(c => (c.id === id ? updated : c)));
    if (antigo && antigo !== updated.nome) {
      const rename = x => (x.cat === antigo ? { ...x, cat: updated.nome } : x);
      setTransactions(prev => prev.map(rename));
      setRecorrentes(prev => prev.map(rename));
    }
    showToast('Categoria atualizada ✓');
    return true;
  }

  async function delCategoria(id) {
    const res = await fetch(`${API}/categorias/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      showToast(body.error || 'Não foi possível remover a categoria.', 'err');
      return;
    }
    setCategorias(prev => prev.filter(c => c.id !== id));
    setEditingCat(e => (e?.id === id ? null : e));
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
      transactions, recorrentes, categorias, toast, showToast,
      editing, setEditing,
      addTransaction, updateTransaction, delTransaction,
      editingRec, setEditingRec,
      addRecorrente, updateRecorrente, delRecorrente,
      editingCat, setEditingCat,
      addCategoria, updateCategoria, delCategoria,
    }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  return useContext(FinanceContext);
}
