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

  const [toast, setToast] = useState({ msg: '', type: 'ok', visible: false, acao: null });
  const toastTimer = useRef(null);

  // `acao` ({ rotulo, onClick }) mostra um botão no aviso, como "Desfazer". Com ação o aviso dura mais.
  const showToast = useCallback((msg, type = 'ok', acao = null) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, type, visible: true, acao });
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), acao ? 6000 : 2800);
  }, []);
  const hideToast = useCallback(() => {
    clearTimeout(toastTimer.current);
    setToast(t => ({ ...t, visible: false }));
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
        // Se algum pedido falhar (ex.: API parada), a tela abre vazia em vez de quebrar.
        setCategorias(cats.ok ? cats.data : []);
        setRecorrentes(recs.ok ? recs.data : []);
        setContas(cts.ok ? cts.data : []);
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
    if (!silent) showToast(data.tipo === 'entrada' ? 'Receita adicionada' : 'Gasto adicionado');
    return true;
  }

  async function updateTransaction(id, data) {
    if (!await enviar(`/transactions/${id}`, 'PUT', data)) return false;
    invalidar();
    showToast('Lançamento atualizado');
    return true;
  }

  // `parcelas`: 'todas' ou 'futuras' para compras parceladas; sem ele, só o lançamento.
  async function delTransaction(id, parcelas) {
    if (!await remover(`/transactions/${id}${parcelas ? `?parcelas=${parcelas}` : ''}`, 'Não foi possível remover.')) return;
    setEditing(e => (e?.id === id ? null : e));
    invalidar();
    showToast('Excluído');
  }

  /* ── Recorrentes ─────────────────────────────────── */
  async function addRecorrente(data) {
    if (!await enviar('/recorrentes', 'POST', data)) return false;
    await carregarRecorrentes();
    showToast('Recorrente adicionado');
    return true;
  }

  async function updateRecorrente(id, data) {
    if (!await enviar(`/recorrentes/${id}`, 'PUT', data)) return false;
    await carregarRecorrentes();
    showToast('Recorrente atualizado');
    return true;
  }

  async function delRecorrente(id) {
    if (!await remover(`/recorrentes/${id}`, 'Não foi possível remover.')) return;
    setEditingRec(e => (e?.id === id ? null : e));
    invalidar();
    showToast('Excluído');
  }

  async function lancarRecorrente(id) {
    if (!await enviar(`/recorrentes/${id}/lancar`, 'POST', { mes: currentYM() })) return false;
    invalidar();
    showToast('Gasto adicionado');
    return true;
  }

  async function lancarPendentes() {
    const r = await enviar('/recorrentes/lancar-pendentes', 'POST', { mes: currentYM() });
    if (!r) return;
    invalidar();
    if (r.lancados) showToast(`${r.lancados} ${r.lancados === 1 ? 'recorrente lançado' : 'recorrentes lançados'}`);
  }

  /* ── Categorias ──────────────────────────────────── */
  async function addCategoria(data) {
    const created = await enviar('/categorias', 'POST', data);
    if (!created) return false;
    setCategorias(prev => [...prev, created].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
    showToast('Categoria criada');
    return true;
  }

  async function updateCategoria(id, data) {
    const updated = await enviar(`/categorias/${id}`, 'PUT', data);
    if (!updated) return false;
    setCategorias(prev => prev.map(c => (c.id === id ? updated : c)));
    invalidar(); // os nomes nos lançamentos e recorrentes mudam junto
    showToast('Categoria atualizada');
    return true;
  }

  async function delCategoria(id) {
    if (!await remover(`/categorias/${id}`, 'Não foi possível remover a categoria.')) return;
    setCategorias(prev => prev.filter(c => c.id !== id));
    setEditingCat(e => (e?.id === id ? null : e));
    showToast('Categoria excluída');
  }

  /* ── Contas e transferências ─────────────────────── */
  async function addConta(data) {
    if (!await enviar('/contas', 'POST', data)) return false;
    await carregarContas();
    showToast('Conta criada');
    return true;
  }

  async function updateConta(id, data) {
    if (!await enviar(`/contas/${id}`, 'PUT', data)) return false;
    await carregarContas();
    showToast('Conta atualizada');
    return true;
  }

  async function delConta(id) {
    if (!await remover(`/contas/${id}`, 'Não foi possível excluir a conta.')) return;
    setEditingConta(e => (e?.id === id ? null : e));
    await carregarContas();
    showToast('Conta excluída');
  }

  async function addTransferencia(data) {
    if (!await enviar('/transferencias', 'POST', data)) return false;
    invalidar();
    showToast('Transferência registrada');
    return true;
  }

  async function delTransferencia(id) {
    if (!await remover(`/transferencias/${id}`, 'Não foi possível remover.')) return;
    invalidar();
    showToast('Transferência excluída');
  }

  if (loading) {
    return (
      <div className="tela-carregando" role="status">Carregando…</div>
    );
  }

  return (
    <FinanceContext.Provider value={{
      categorias, recorrentes, contas, versao, invalidar, toast, showToast, hideToast,
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
