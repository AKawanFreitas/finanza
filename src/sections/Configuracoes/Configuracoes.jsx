import { useEffect, useRef, useState } from 'react';
import { Check, LogOut, Trash2, Settings, User, Type, Mail, Bell, KeyRound, Lock, Info, AlertTriangle, ArrowRight, Headset, Sun, Moon, Monitor, Palette, Camera } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import PageHeader from '../../components/PageHeader';
import InfoBanner from '../../components/InfoBanner';
import { api } from '../../utils/api';
import { fmtDate } from '../../utils/formatters';
import { lerTema, salvarTema } from '../../utils/tema';
import { prepararFoto } from '../../utils/foto';
import Avatar from '../../components/Avatar';

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

// Escolher, trocar ou remover a foto: o arquivo é reduzido no navegador antes de subir.
function FotoPerfil({ user, bloqueado }) {
  const { salvarFoto, removerFoto } = useAuth();
  const { showToast } = useFinance();
  const acao = useAcao(showToast);
  const campo = useRef(null);

  async function escolher(e) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    await acao.executar(async () => salvarFoto(await prepararFoto(arquivo)), 'Foto atualizada');
  }

  return (
    <div className="foto-perfil">
      <Avatar user={user} className="avatar-grande" />
      <div className="foto-perfil-info">
        <strong>Foto de perfil</strong>
        <small>JPG, PNG ou WebP. Ela aparece no menu e fica só na sua conta.</small>
        <div className="foto-perfil-acoes">
          <input ref={campo} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={escolher} />
          <button type="button" className="btn" disabled={acao.ocupado || bloqueado} onClick={() => campo.current.click()}>
            <Camera size={16} strokeWidth={2} />{user.foto_url ? 'Trocar foto' : 'Escolher foto'}
          </button>
          {user.foto_url && (
            <button type="button" className="btn" disabled={acao.ocupado || bloqueado} onClick={() => acao.executar(removerFoto, 'Foto removida')}>
              <Trash2 size={16} strokeWidth={2} />Remover
            </button>
          )}
        </div>
        {acao.erro && <p className="aviso-erro" role="alert">{acao.erro}</p>}
      </div>
    </div>
  );
}

const OPCOES_TEMA = [
  { id: 'sistema', rotulo: 'Automático', Icon: Monitor },
  { id: 'claro',   rotulo: 'Claro',      Icon: Sun },
  { id: 'escuro',  rotulo: 'Escuro',     Icon: Moon },
];

// Vale só neste aparelho: cada navegador guarda a sua escolha.
function Aparencia() {
  const [tema, setTema] = useState(lerTema);
  const escolher = id => { salvarTema(id); setTema(id); };

  return (
    <section className="panel">
      <div className="panel-head"><h2><Palette size={20} />Aparência</h2></div>
      <div className="panel-body">
        <div className="tipo-toggle" role="radiogroup" aria-label="Tema da interface">
          {OPCOES_TEMA.map(({ id, rotulo, Icon }) => (
            <button
              key={id} type="button" role="radio" aria-checked={tema === id}
              className={`tipo-btn${tema === id ? ' active-entrada' : ''}`}
              onClick={() => escolher(id)}
            >
              <Icon size={16} strokeWidth={2} />{rotulo}
            </button>
          ))}
        </div>
        <p className="form-dica"><Info size={14} />Automático acompanha o modo claro ou escuro do seu aparelho. A escolha vale só neste navegador.</p>
      </div>
    </section>
  );
}

const ENCERRAMENTO = { admin: 'Encerrado pelo suporte', tempo: 'Encerrado por inatividade', sistema: 'Encerrado' };
const quandoLocal = iso => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const duracao = s => (s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`);

// Acessos que o suporte fez na conta: quando, por quê, quanto tempo e o que foi alterado.
function AcessosDeSuporte() {
  const [lista, setLista] = useState(null);
  useEffect(() => {
    let vivo = true;
    api('/suporte/historico').then(({ ok, data }) => { if (vivo && ok) setLista(data); }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  return (
    <section className="panel">
      <div className="panel-head"><h2><Headset size={20} />Acessos de suporte</h2></div>
      <div className="panel-body">
        {!lista ? <p className="empty">Carregando...</p> : lista.length === 0 ? (
          <p className="form-dica"><Info size={14} />Nenhum acesso de suporte à sua conta até agora. Se um dia o suporte precisar entrar, você vê o aviso na hora e o registro aqui.</p>
        ) : (
          <ul className="suporte-lista">
            {lista.map(c => (
              <li key={c.id} className="suporte-item">
                <div className="suporte-item-topo">
                  <strong>{quandoLocal(c.aberto_em)}</strong>
                  <span className={`chip ${c.encerrado_em ? '' : 'warn'}`}>{c.encerrado_em ? ENCERRAMENTO[c.encerrado_por] : 'Em andamento'}</span>
                </div>
                <p>{c.motivo}</p>
                <small>
                  Por {c.admin_nome}{c.duracao_s != null && <> · duração {duracao(c.duracao_s)}</>}
                </small>
                <div className="suporte-acoes">
                  {c.alteracoes.length === 0
                    ? <span className="chip">Só visualização, nada foi alterado</span>
                    : c.alteracoes.map(a => <span key={a.rotulo} className="chip">{a.rotulo}{a.n > 1 && ` × ${a.n}`}</span>)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
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
      <PageHeader Icon={Settings} titulo="Configurações" subtitulo="Seus dados de acesso e a sua conta">
        <button className="btn" onClick={sair}>
          <LogOut size={16} strokeWidth={2} />
          Sair
        </button>
      </PageHeader>

      {user.suporte && <InfoBanner>Acesso de suporte: alterar senha, e-mail e perfil, e excluir a conta, ficam bloqueados.</InfoBanner>}

      <section className="panel">
        <div className="panel-head">
          <h2><User size={20} />Perfil</h2>
          {user.papel === 'superadmin' && <span className="chip good">Administrador</span>}
        </div>
        <form className="panel-body form-stack" onSubmit={enviarPerfil}>
          <FotoPerfil user={user} bloqueado={!!user.suporte} />
          {acaoPerfil.erro && <p className="aviso-erro" role="alert">{acaoPerfil.erro}</p>}

          <div className="form-duplo">
            <label className="form-group">
              <span className="form-label"><Type size={16} />Nome</span>
              <span className="form-input-wrap">
                <span className="form-prefix"><User size={16} strokeWidth={2} /></span>
                <input
                  className="form-control" required autoComplete="name"
                  value={perfil.nome} onChange={e => setPerfil(p => ({ ...p, nome: e.target.value }))}
                />
              </span>
            </label>
            <label className="form-group">
              <span className="form-label"><Mail size={16} />E-mail</span>
              <span className="form-input-wrap">
                <span className="form-prefix"><Mail size={16} strokeWidth={2} /></span>
                <input
                  className="form-control" type="email" required autoComplete="email"
                  value={perfil.email} onChange={e => setPerfil(p => ({ ...p, email: e.target.value }))}
                />
              </span>
            </label>
          </div>

          <p className="form-dica"><Info size={14} />Conta criada em {fmtDate(user.criado_em.slice(0, 10))}.</p>

          <div className="form-acoes">
            <button className="btn btn-primary" type="submit" disabled={!perfilMudou || acaoPerfil.ocupado}>
              <Check size={15} strokeWidth={2.5} />
              {acaoPerfil.ocupado ? 'Salvando...' : 'Salvar alterações'}
              <ArrowRight size={15} strokeWidth={2.5} />
            </button>
          </div>
        </form>
      </section>

      <Aparencia />

      <section className="panel">
        <div className="panel-head"><h2><Bell size={20} />Avisos por e-mail</h2></div>
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
        <div className="panel-head"><h2><KeyRound size={20} />Senha</h2></div>
        <form className="panel-body form-stack" onSubmit={enviarSenha}>
          {acaoSenha.erro && <p className="aviso-erro" role="alert">{acaoSenha.erro}</p>}

          <div className="form-duplo">
            <label className="form-group">
              <span className="form-label"><Lock size={16} />Senha atual</span>
              <span className="form-input-wrap">
                <span className="form-prefix"><Lock size={16} strokeWidth={2} /></span>
                <input
                  className="form-control" type="password" required autoComplete="current-password"
                  value={senhas.atual} onChange={e => setSenhas(s => ({ ...s, atual: e.target.value }))}
                />
              </span>
            </label>
            <label className="form-group">
              <span className="form-label"><KeyRound size={16} />Nova senha</span>
              <span className="form-input-wrap">
                <span className="form-prefix"><KeyRound size={16} strokeWidth={2} /></span>
                <input
                  className="form-control" type="password" required minLength={8} autoComplete="new-password"
                  value={senhas.nova} onChange={e => setSenhas(s => ({ ...s, nova: e.target.value }))}
                />
              </span>
            </label>
          </div>

          <p className="form-dica">
            <Info size={14} />Pelo menos 8 caracteres. Trocar a senha encerra as sessões abertas em outros aparelhos.
          </p>

          <div className="form-acoes">
            <button className="btn btn-primary" type="submit" disabled={acaoSenha.ocupado}>
              <Check size={15} strokeWidth={2.5} />
              {acaoSenha.ocupado ? 'Salvando...' : 'Alterar senha'}
              <ArrowRight size={15} strokeWidth={2.5} />
            </button>
          </div>
        </form>
      </section>

      <AcessosDeSuporte />

      {user.papel !== 'superadmin' && !user.suporte && (
        <section className="panel panel-risco">
          <div className="panel-head"><h2><AlertTriangle size={20} />Excluir conta</h2></div>
          <div className="panel-body form-stack">
            <p className="form-dica">
              <Info size={14} />Apaga a conta e todos os lançamentos, recorrentes e categorias dela. Não dá para desfazer.
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
                  <span className="form-label"><Lock size={16} />Confirme com a sua senha</span>
                  <span className="form-input-wrap">
                    <span className="form-prefix"><Lock size={16} strokeWidth={2} /></span>
                    <input
                      className="form-control" type="password" required autoComplete="current-password"
                      value={confirmacao} onChange={e => setConfirmacao(e.target.value)}
                    />
                  </span>
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
