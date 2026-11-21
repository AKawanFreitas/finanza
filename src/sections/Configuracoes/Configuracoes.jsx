import { useState } from 'react';
import { Check, LogOut, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { fmtDate } from '../../utils/formatters';

// Cada bloco tem o seu próprio aviso de erro, para a pessoa ver o resultado onde agiu.
function useAcao(showToast) {
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function executar(acao, mensagemOk) {
    setErro('');
    setOcupado(true);
    try {
      await acao();
      if (mensagemOk) showToast(mensagemOk);
      return true;
    } catch (err) {
      setErro(err.message);
      return false;
    } finally {
      setOcupado(false);
    }
  }

  return { erro, ocupado, executar, limparErro: () => setErro('') };
}

export default function Configuracoes() {
  const { user, salvarPerfil, trocarSenha, excluirConta, sair, salvarPreferencias } = useAuth();
  const { showToast } = useFinance();

  const [perfil, setPerfil] = useState({ nome: user.nome, email: user.email });
  const [senhas, setSenhas] = useState({ atual: '', nova: '' });
  const [confirmacao, setConfirmacao] = useState('');
  const [excluindo, setExcluindo] = useState(false);

  const acaoPerfil  = useAcao(showToast);
  const acaoSenha   = useAcao(showToast);
  const acaoExcluir = useAcao(showToast);
  const acaoAvisos  = useAcao(showToast);

  const perfilMudou = perfil.nome !== user.nome || perfil.email !== user.email;

  async function enviarPerfil(e) {
    e.preventDefault();
    await acaoPerfil.executar(() => salvarPerfil(perfil.nome, perfil.email), 'Perfil atualizado');
  }

  async function enviarSenha(e) {
    e.preventDefault();
    const ok = await acaoSenha.executar(() => trocarSenha(senhas.atual, senhas.nova), 'Senha alterada');
    if (ok) setSenhas({ atual: '', nova: '' });
  }

  async function enviarExclusao(e) {
    e.preventDefault();
    await acaoExcluir.executar(() => excluirConta(confirmacao));
  }

  return (
    <div className="section-enter">
      <header className="page-bar">
        <div>
          <h1 className="page-title">Configurações</h1>
          <p className="page-subtitle">Seus dados de acesso e a sua conta</p>
        </div>
        <button className="btn" onClick={sair}>
          <LogOut size={15} strokeWidth={2} />
          Sair
        </button>
      </header>

      <section className="panel">
        <div className="panel-head">
          <h2>Perfil</h2>
          {user.papel === 'superadmin' && <span className="chip good">Administrador</span>}
        </div>
        <form className="panel-body form-stack" onSubmit={enviarPerfil}>
          {acaoPerfil.erro && <p className="aviso-erro" role="alert">{acaoPerfil.erro}</p>}

          <div className="form-duplo">
            <label className="form-group">
              <span className="form-label">Nome</span>
              <input
                className="form-control" required autoComplete="name"
                value={perfil.nome} onChange={e => setPerfil(p => ({ ...p, nome: e.target.value }))}
              />
            </label>
            <label className="form-group">
              <span className="form-label">E-mail</span>
              <input
                className="form-control" type="email" required autoComplete="email"
                value={perfil.email} onChange={e => setPerfil(p => ({ ...p, email: e.target.value }))}
              />
            </label>
          </div>

          <p className="form-dica">Conta criada em {fmtDate(user.criado_em.slice(0, 10))}.</p>

          <div className="form-acoes">
            <button className="btn btn-primary" type="submit" disabled={!perfilMudou || acaoPerfil.ocupado}>
              <Check size={15} strokeWidth={2.5} />
              {acaoPerfil.ocupado ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Avisos por e-mail</h2></div>
        <div className="panel-body">
          {acaoAvisos.erro && <p className="aviso-erro" role="alert">{acaoAvisos.erro}</p>}
          <label className="opcao-check">
            <input
              type="checkbox" checked={user.notificacoes_email} disabled={acaoAvisos.ocupado}
              onChange={e => acaoAvisos.executar(() => salvarPreferencias(e.target.checked), e.target.checked ? 'Avisos ativados' : 'Avisos desativados')}
            />
            <span>
              <strong>Alertas de orçamento e resumo mensal</strong>
              <small>
                Avisamos quando uma categoria chega a 80% e a 100% do limite, e mandamos um resumo do mês nos primeiros dias do mês seguinte.
                {!user.email_verificado && ' Os avisos só são enviados depois que você confirmar o e-mail.'}
              </small>
            </span>
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Senha</h2></div>
        <form className="panel-body form-stack" onSubmit={enviarSenha}>
          {acaoSenha.erro && <p className="aviso-erro" role="alert">{acaoSenha.erro}</p>}

          <div className="form-duplo">
            <label className="form-group">
              <span className="form-label">Senha atual</span>
              <input
                className="form-control" type="password" required autoComplete="current-password"
                value={senhas.atual} onChange={e => setSenhas(s => ({ ...s, atual: e.target.value }))}
              />
            </label>
            <label className="form-group">
              <span className="form-label">Nova senha</span>
              <input
                className="form-control" type="password" required minLength={8} autoComplete="new-password"
                value={senhas.nova} onChange={e => setSenhas(s => ({ ...s, nova: e.target.value }))}
              />
            </label>
          </div>

          <p className="form-dica">
            Pelo menos 8 caracteres. Trocar a senha encerra as sessões abertas em outros aparelhos.
          </p>

          <div className="form-acoes">
            <button className="btn btn-primary" type="submit" disabled={acaoSenha.ocupado}>
              <Check size={15} strokeWidth={2.5} />
              {acaoSenha.ocupado ? 'Salvando...' : 'Alterar senha'}
            </button>
          </div>
        </form>
      </section>

      {user.papel !== 'superadmin' && (
        <section className="panel panel-risco">
          <div className="panel-head"><h2>Excluir conta</h2></div>
          <div className="panel-body form-stack">
            <p className="form-dica">
              Apaga a conta e todos os lançamentos, recorrentes e categorias dela. Não dá para desfazer.
            </p>

            {acaoExcluir.erro && <p className="aviso-erro" role="alert">{acaoExcluir.erro}</p>}

            {!excluindo ? (
              <div className="form-acoes">
                <button className="btn btn-perigo" onClick={() => setExcluindo(true)}>
                  <Trash2 size={15} strokeWidth={2} />
                  Excluir minha conta
                </button>
              </div>
            ) : (
              <form className="form-stack" onSubmit={enviarExclusao}>
                <label className="form-group form-estreito">
                  <span className="form-label">Confirme com a sua senha</span>
                  <input
                    className="form-control" type="password" required autoComplete="current-password"
                    value={confirmacao} onChange={e => setConfirmacao(e.target.value)}
                  />
                </label>
                <div className="form-acoes">
                  <button className="btn btn-perigo" type="submit" disabled={acaoExcluir.ocupado}>
                    {acaoExcluir.ocupado ? 'Excluindo...' : 'Excluir definitivamente'}
                  </button>
                  <button
                    className="btn" type="button"
                    onClick={() => { setExcluindo(false); setConfirmacao(''); acaoExcluir.limparErro(); }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
