import { useCallback, useEffect, useState } from 'react';
import { Search, KeyRound, Ban, CheckCircle2, Trash2, Copy, Shield, Users, UserPlus, Activity, ArrowLeftRight } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { fmtDate } from '../../utils/formatters';
import PageHeader from '../../components/PageHeader';
import Kpi from '../Dashboard/Kpi';
import IconButton from '../../components/IconButton';

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
      <PageHeader Icon={Shield} titulo="Administração" subtitulo="Contas e uso do sistema" />

      {erro && <p className="aviso-erro" role="alert">{erro}</p>}

      {metricas && (
        <section className="kpis" aria-label="Números do sistema">
          <Kpi tone="brand" Icon={Users} label="Usuários" value={metricas.usuarios} note={`${metricas.ativos} ativos, ${metricas.suspensos} suspensos`} />
          <Kpi Icon={UserPlus} kind="in" label="Novos no mês" value={metricas.novosNoMes} note="contas criadas" />
          <Kpi Icon={Activity} kind="fix" label="Acessaram em 30 dias" value={metricas.acessaram30d} note={`${metricas.sessoesAbertas} sessões abertas`} />
          <Kpi Icon={ArrowLeftRight} kind="fix" label="Lançamentos" value={metricas.lancamentos} note="em todas as contas" />
        </section>
      )}

      {provisoria && (
        <section className="panel panel-destaque">
          <div className="panel-head"><h2><KeyRound size={20} />Senha provisória de {provisoria.email}</h2></div>
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
          <h2><Users size={20} />Usuários</h2>
          <span className="card-sub pill">{usuarios.length} {usuarios.length === 1 ? 'conta' : 'contas'}</span>
        </div>

        <div className="filters">
          <div className="form-input-wrap filters-search">
            <span className="form-prefix"><Search size={16} strokeWidth={2} /></span>
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
                  <td className="strong"><span className="admin-nome"><span className="conta-avatar admin-avatar" aria-hidden="true">{u.nome.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()}</span>{u.nome}</span></td>
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
                        <IconButton label="Redefinir senha" onClick={() => redefinirSenha(u)}>
                          <KeyRound size={14} strokeWidth={2} />
                        </IconButton>
                        <IconButton label={u.status === 'ativo' ? 'Suspender conta' : 'Reativar conta'} onClick={() => alternarStatus(u)}>
                          {u.status === 'ativo'
                            ? <Ban size={14} strokeWidth={2} />
                            : <CheckCircle2 size={14} strokeWidth={2} />}
                        </IconButton>
                        <IconButton label="Excluir conta" danger onClick={() => setConfirmando(u.id)}>
                          <Trash2 size={14} strokeWidth={2} />
                        </IconButton>
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
