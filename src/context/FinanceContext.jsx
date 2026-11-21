import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { api } from '../utils/api';
import { currentYM } from '../utils/period';

const FinanceContext = createContext(null);

export function FinanceProvider({ children }) {
  // Lançamentos não ficam aqui: cada tela pede ao servidor o que precisa (filtrado e paginado).
  // `versao` sobe a cada mudança nos lançamentos, e as telas refazem o pedido.
  const [categorias, setCategorias]   = useState([]);
  const [recorrentes, setRecorrentes] = useState([]);
  const [contas, setContas]           = useState([]);
  const [versao, setVersao]           = useState(0);
  const [loading, setLoading]         = useState(true);
  const [editing, setEditing]         = useState(null);
  const [editingRec, setEditingRec]   = useState(null);
  const [editingCat, setEditingCat]   = useState(null);
  const [editingConta, setEditingConta] = useState(null);

  const [toast, setToast] = useState({ msg: '', type: 'ok', visible: false });
  const toastTimer = useRef(null);

  const showToast = useCallback((msg, type = 'ok') => {
    clearTimeout(toastTimer.current);
    setToast({ msg, type, visible: true });
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 2400);
  }, []);

  const carregarContas = useCallback(async () => {
    const { ok, data } = await api('/contas');
    if (ok) setContas(data);
  }, []);

  const carregarRecorrentes = useCallback(async () => {
    const { ok, data } = await api(`/recorrentes?mes=${currentYM()}`);
    if (ok) setRecorrentes(data);
  }, []);

  // Lançamentos mudaram: telas refazem a consulta e os saldos das contas são recalculados.
  const invalidar = useCallback(() => {
    setVersao(v => v + 1);
    carregarContas();
    carregarRecorrentes();
  }, [carregarContas, carregarRecorrentes]);

  useEffect(() => {
    Promise.all([api('/categorias'), api('/recorrentes?mes=' + currentYM()), api('/contas')])
      .then(([cats, recs, cts]) => {
        setCategorias(cats.data ?? []);
        setRecorrentes(recs.data ?? []);
        setContas(cts.data ?? []);
        setLoading(false);
      });
  }, []);

  // POST/PUT que mostra o erro do servidor num toast. Devolve o corpo ou null.
  async function enviar(path, method, body) {
    const { ok, data } = await api(path, { method, body });
    if (!ok) {
      showToast(data?.error || 'Não foi possível salvar.', 'err');
      return null;
    }
    return data;
  }

  async function remover(path, mensagemErro) {
    const { ok, data } = await api(path, { method: 'DELETE' });
    if (!ok) {
      showToast(data?.error || mensagemErro, 'err');
      return false;
    }
    return true;
  }

  /* ── Lançamentos ─────────────────────────────────── */
  async function addTransaction(data, { silent = false } = {}) {
    if (!await enviar('/transactions', 'POST', data)) return false;
    invalidar();
    if (!silent) showToast(data.tipo === 'entrada' ? 'Receita adicionada ✓' : 'Gasto adicionado ✓');
    return true;
  }

  async function updateTransaction(id, data) {
    if (!await enviar(`/transactions/${id}`, 'PUT', data)) return false;
    invalidar();
    showToast('Lançamento atualizado ✓');
    return true;
  }

  // `parcelas`: 'todas' ou 'futuras' para compras parceladas; sem ele, só o lançamento.
  async function delTransaction(id, parcelas) {
    if (!await remover(`/transactions/${id}${parcelas ? `?parcelas=${parcelas}` : ''}`, 'Não foi possível remover.')) return;
    setEditing(e => (e?.id === id ? null : e));
    invalidar();
    showToast('Removido', 'err');
  }

  /* ── Recorrentes ─────────────────────────────────── */
  async function addRecorrente(data) {
    if (!await enviar('/recorrentes', 'POST', data)) return false;
    await carregarRecorrentes();
    showToast('Recorrente adicionado ✓');
    return true;
  }

  async function updateRecorrente(id, data) {
    if (!await enviar(`/recorrentes/${id}`, 'PUT', data)) return false;
    await carregarRecorrentes();
    showToast('Recorrente atualizado ✓');
    return true;
  }

  async function delRecorrente(id) {
    if (!await remover(`/recorrentes/${id}`, 'Não foi possível remover.')) return;
    setEditingRec(e => (e?.id === id ? null : e));
    invalidar();
    showToast('Removido', 'err');
  }

  async function lancarRecorrente(id) {
    if (!await enviar(`/recorrentes/${id}/lancar`, 'POST', { mes: currentYM() })) return false;
    invalidar();
    showToast('Gasto adicionado ✓');
    return true;
  }

  async function lancarPendentes() {
    const r = await enviar('/recorrentes/lancar-pendentes', 'POST', { mes: currentYM() });
    if (!r) return;
    invalidar();
    if (r.lancados) showToast(`${r.lancados} ${r.lancados === 1 ? 'recorrente lançado' : 'recorrentes lançados'} ✓`);
  }

  /* ── Categorias ──────────────────────────────────── */
  async function addCategoria(data) {
    const created = await enviar('/categorias', 'POST', data);
    if (!created) return false;
    setCategorias(prev => [...prev, created].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
    showToast('Categoria criada ✓');
    return true;
  }

  async function updateCategoria(id, data) {
    const updated = await enviar(`/categorias/${id}`, 'PUT', data);
    if (!updated) return false;
    setCategorias(prev => prev.map(c => (c.id === id ? updated : c)));
    invalidar(); // os nomes nos lançamentos e recorrentes mudam junto
    showToast('Categoria atualizada ✓');
    return true;
  }

  async function delCategoria(id) {
    if (!await remover(`/categorias/${id}`, 'Não foi possível remover a categoria.')) return;
    setCategorias(prev => prev.filter(c => c.id !== id));
    setEditingCat(e => (e?.id === id ? null : e));
    showToast('Categoria removida', 'err');
  }

  /* ── Contas e transferências ─────────────────────── */
  async function addConta(data) {
    if (!await enviar('/contas', 'POST', data)) return false;
    await carregarContas();
    showToast('Conta criada ✓');
    return true;
  }

  async function updateConta(id, data) {
    if (!await enviar(`/contas/${id}`, 'PUT', data)) return false;
    await carregarContas();
    showToast('Conta atualizada ✓');
    return true;
  }

  async function delConta(id) {
    if (!await remover(`/contas/${id}`, 'Não foi possível excluir a conta.')) return;
    setEditingConta(e => (e?.id === id ? null : e));
    await carregarContas();
    showToast('Conta removida', 'err');
  }

  async function addTransferencia(data) {
    if (!await enviar('/transferencias', 'POST', data)) return false;
    invalidar();
    showToast('Transferência registrada ✓');
    return true;
  }

  async function delTransferencia(id) {
    if (!await remover(`/transferencias/${id}`, 'Não foi possível remover.')) return;
    invalidar();
    showToast('Transferência removida', 'err');
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
      categorias, recorrentes, contas, versao, invalidar, toast, showToast,
      editing, setEditing,
      addTransaction, updateTransaction, delTransaction,
      editingRec, setEditingRec,
      addRecorrente, updateRecorrente, delRecorrente, lancarRecorrente, lancarPendentes,
      editingCat, setEditingCat,
      addCategoria, updateCategoria, delCategoria,
      editingConta, setEditingConta,
      addConta, updateConta, delConta, addTransferencia, delTransferencia,
    }}>
      {children}
    </FinanceContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFinance() {
  return useContext(FinanceContext);
}
