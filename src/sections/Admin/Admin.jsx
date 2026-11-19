import { useCallback, useEffect, useState } from 'react';
import { Search, KeyRound, Ban, CheckCircle2, Trash2, Copy } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { fmtDate } from '../../utils/formatters';

const API = '/api/admin';

async function pedir(caminho, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${caminho}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const dados = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(dados.error || 'Não foi possível concluir.');
  return dados;
}

const quando = iso => (iso ? fmtDate(iso.slice(0, 10)) : '—');

export default function Admin() {
  const { showToast } = useFinance();
  const [usuarios, setUsuarios] = useState([]);
  const [metricas, setMetricas] = useState(null);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [provisoria, setProvisoria] = useState(null);   // { email, senha }
  const [confirmando, setConfirmando] = useState(null); // id em confirmação de exclusão

  const carregar = useCallback(async (termo = '') => {
    setErro('');
    try {
      const [lista, nums] = await Promise.all([
        pedir(`/usuarios?busca=${encodeURIComponent(termo)}`),
        pedir('/metricas'),
      ]);
      setUsuarios(lista);
      setMetricas(nums);
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  // Busca com pequena espera, para não consultar a cada tecla.
  useEffect(() => {
    const id = setTimeout(() => carregar(busca), 250);
    return () => clearTimeout(id);
  }, [busca, carregar]);

  async function agir(acao, mensagem) {
    try {
      await acao();
      if (mensagem) showToast(mensagem);
      await carregar(busca);
    } catch (err) {
      showToast(err.message, 'err');
    }
  }

  const alternarStatus = u => agir(
    () => pedir(`/usuarios/${u.id}/status`, {
      method: 'PATCH',
      body: { status: u.status === 'ativo' ? 'suspenso' : 'ativo' },
    }),
    u.status === 'ativo' ? 'Conta suspensa' : 'Conta reativada',
  );

  async function redefinirSenha(u) {
    try {
      const { senha_provisoria } = await pedir(`/usuarios/${u.id}/senha`, { method: 'POST' });
      setProvisoria({ email: u.email, senha: senha_provisoria });
      await carregar(busca);
    } catch (err) {
      showToast(err.message, 'err');
    }
  }

  const excluir = u => agir(() => pedir(`/usuarios/${u.id}`, { method: 'DELETE' }), 'Conta excluída');

  return (
    <div className="section-enter">
      <header className="page-bar">
        <div>
          <h1 className="page-title">Administração</h1>
          <p className="page-subtitle">Contas e uso do sistema</p>
        </div>
      </header>

      {erro && <p className="aviso-erro" role="alert">{erro}</p>}

      {metricas && (
        <section className="kpis" aria-label="Números do sistema">
          <div className="kpi kpi-brand">
            <div className="kpi-top"><span className="kpi-label">Usuários</span></div>
            <div className="kpi-value">{metricas.usuarios}</div>
            <div className="kpi-bottom">
              <span className="kpi-note">{metricas.ativos} ativos, {metricas.suspensos} suspensos</span>
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-top"><span className="kpi-label">Novos no mês</span></div>
            <div className="kpi-value">{metricas.novosNoMes}</div>
            <div className="kpi-bottom"><span className="kpi-note">contas criadas</span></div>
          </div>
          <div className="kpi">
            <div className="kpi-top"><span className="kpi-label">Acessaram em 30 dias</span></div>
            <div className="kpi-value">{metricas.acessaram30d}</div>
            <div className="kpi-bottom"><span className="kpi-note">{metricas.sessoesAbertas} sessões abertas</span></div>
          </div>
          <div className="kpi">
            <div className="kpi-top"><span className="kpi-label">Lançamentos</span></div>
            <div className="kpi-value">{metricas.lancamentos}</div>
            <div className="kpi-bottom"><span className="kpi-note">em todas as contas</span></div>
          </div>
        </section>
      )}

      {provisoria && (
        <section className="panel panel-destaque">
          <div className="panel-head"><h2>Senha provisória de {provisoria.email}</h2></div>
          <div className="panel-body form-stack">
            <p className="form-dica">
              Ela aparece uma única vez. Entregue à pessoa por um canal seguro: no próximo acesso
              o sistema vai pedir que ela escolha uma senha própria.
            </p>
            <div className="senha-provisoria">
              <code>{provisoria.senha}</code>
              <button
                className="btn btn-sm"
                onClick={() => navigator.clipboard?.writeText(provisoria.senha)
                  .then(() => showToast('Senha copiada'))
                  .catch(() => showToast('Copie o texto à mão.', 'err'))}
              >
                <Copy size={14} strokeWidth={2} />
                Copiar
              </button>
              <button className="btn btn-sm" onClick={() => setProvisoria(null)}>Pronto</button>
            </div>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2>Usuários</h2>
          <span className="card-sub">{usuarios.length} {usuarios.length === 1 ? 'conta' : 'contas'}</span>
        </div>

        <div className="filters">
          <div className="form-input-wrap filters-search">
            <span className="form-prefix"><Search size={15} strokeWidth={2} /></span>
            <input
              className="form-control" placeholder="Buscar por nome ou e-mail"
              aria-label="Buscar usuários"
              value={busca} onChange={e => setBusca(e.target.value)}
            />
          </div>
        </div>

        {carregando ? (
          <p className="empty">Carregando...</p>
        ) : usuarios.length === 0 ? (
          <p className="empty">Nenhuma conta encontrada.</p>
        ) : (
          <div className="tabela-rolagem">
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Cadastro</th>
                <th>Último acesso</th>
                <th className="num">Lançamentos</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id}>
                  <td className="strong">{u.nome}</td>
                  <td className="muted">{u.email}</td>
                  <td className="muted">{quando(u.criado_em)}</td>
                  <td className="muted">{quando(u.ultimo_acesso)}</td>
                  <td className="num">{u.lancamentos}</td>
                  <td>
                    {u.papel === 'superadmin'
                      ? <span className="chip good">Administrador</span>
                      : u.status === 'ativo'
                        ? <span className="chip">Ativo</span>
                        : <span className="chip bad">Suspenso</span>}
                    {u.trocar_senha && <span className="chip warn">Troca pendente</span>}
                  </td>
                  <td>
                    {u.papel === 'superadmin' ? (
                      <span className="muted">—</span>
                    ) : confirmando === u.id ? (
                      <div className="linha-acoes">
                        <button className="btn btn-sm btn-perigo" onClick={() => excluir(u)}>Confirmar exclusão</button>
                        <button className="btn btn-sm" onClick={() => setConfirmando(null)}>Cancelar</button>
                      </div>
                    ) : (
                      <div className="linha-acoes">
                        <button className="del-btn" title="Redefinir senha" onClick={() => redefinirSenha(u)}>
                          <KeyRound size={14} strokeWidth={2} />
                        </button>
                        <button
                          className="del-btn"
                          title={u.status === 'ativo' ? 'Suspender conta' : 'Reativar conta'}
                          onClick={() => alternarStatus(u)}
                        >
                          {u.status === 'ativo'
                            ? <Ban size={14} strokeWidth={2} />
                            : <CheckCircle2 size={14} strokeWidth={2} />}
                        </button>
                        <button className="del-btn" title="Excluir conta" onClick={() => setConfirmando(u.id)}>
                          <Trash2 size={14} strokeWidth={2} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>
    </div>
  );
}
