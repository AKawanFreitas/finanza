import { useState } from 'react';
import { Mail, User, UserPlus, Eye, EyeOff, Send, ArrowLeft, KeyRound, ArrowRight, Info } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import EntrarMarca from '../../components/EntrarMarca';

export default function Entrar() {
  const { entrar, criarConta, esqueciSenha } = useAuth();
  const [modo, setModo] = useState('login'); // 'login' | 'conta' | 'esqueci'
  const [aviso, setAviso] = useState('');
  const [form, setForm] = useState({ nome: '', email: '', senha: '' });
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [verSenha, setVerSenha] = useState(false);

  const novaConta = modo === 'conta';
  const recuperar = modo === 'esqueci';
  const set = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }));

  function trocarModo(proximo) {
    setModo(proximo);
    setErro('');
    setAviso('');
    setForm(f => ({ ...f, nome: '', senha: '' }));
    setVerSenha(false);
  }

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      if (recuperar) {
        const r = await esqueciSenha(form.email);
        setAviso(r.mensagem);
        setEnviando(false);
        return;
      }
      if (novaConta) await criarConta(form.nome, form.email, form.senha);
      else await entrar(form.email, form.senha);
    } catch (err) {
      setErro(err.message);
      setEnviando(false);
    }
  }

  return (
    <div className="entrar">
      <EntrarMarca />

      <section className="entrar-painel">
        <form className="entrar-form" onSubmit={enviar}>
          <span className="entrar-selo" aria-hidden="true"><img src="/logo sem texto - finanza.png" alt="" /></span>
          <h2>{recuperar ? 'Recuperar senha' : novaConta ? 'Criar conta' : 'Entrar na sua conta'}</h2>
          <p className="entrar-sub">
            {recuperar ? 'Informe seu e-mail e enviaremos um link para escolher uma nova senha.'
              : novaConta ? 'Crie sua conta para começar a organizar suas finanças.'
              : 'Bem-vindo de volta! Faça login para continuar.'}
          </p>
          {aviso && <p className="aviso-ok" role="status">{aviso}</p>}
          {erro && <p className="aviso-erro" role="alert">{erro}</p>}

          {novaConta && (
            <label className="form-group">
              <span className="sr-only">Nome</span>
              <span className="form-input-wrap">
                <span className="form-prefix"><User size={18} strokeWidth={2} /></span>
                <input
                  className="form-control" autoComplete="name" required placeholder="Nome"
                  value={form.nome} onChange={e => set('nome', e.target.value)}
                />
              </span>
            </label>
          )}

          <label className="form-group">
            <span className="sr-only">E-mail</span>
            <span className="form-input-wrap">
              <span className="form-prefix"><Mail size={18} strokeWidth={2} /></span>
              <input
                className="form-control" type="email" autoComplete="email" required placeholder="E-mail"
                value={form.email} onChange={e => set('email', e.target.value)}
              />
            </span>
          </label>

          {!recuperar && <label className="form-group">
            <span className="sr-only">Senha</span>
            <span className="form-input-wrap">
              <span className="form-prefix"><KeyRound size={18} strokeWidth={2} /></span>
              <input
                className="form-control" type={verSenha ? 'text' : 'password'} required placeholder="Senha"
                autoComplete={novaConta ? 'new-password' : 'current-password'}
                minLength={novaConta ? 8 : undefined}
                value={form.senha} onChange={e => set('senha', e.target.value)}
              />
              <button
                type="button" className="form-sufixo"
                onClick={() => setVerSenha(v => !v)}
                aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
                title={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {verSenha ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
              </button>
            </span>
            {novaConta && <span className="form-dica"><Info size={14} />Pelo menos 8 caracteres.</span>}
          </label>}

          {modo === 'login' && (
            <button type="button" className="link-btn entrar-esqueci" onClick={() => trocarModo('esqueci')}>
              Esqueceu minha senha?
            </button>
          )}

          <button className="btn btn-primary btn-full" type="submit" disabled={enviando}>
            {recuperar ? <Send size={17} strokeWidth={2.5} /> : novaConta ? <UserPlus size={17} strokeWidth={2.5} /> : <ArrowRight size={17} strokeWidth={2.5} />}
            {enviando ? 'Aguarde...' : recuperar ? 'Enviar link' : novaConta ? 'Criar conta' : 'Entrar'}
          </button>

          {recuperar ? (
            <p className="entrar-troca">
              <button type="button" className="link-btn" onClick={() => trocarModo('login')}>
                <ArrowLeft size={13} strokeWidth={2.5} style={{ verticalAlign: '-2px' }} /> Voltar para entrar
              </button>
            </p>
          ) : (
            <p className="entrar-troca">
              {novaConta ? 'Já tem conta?' : 'Ainda não tem conta?'}{' '}
              <button type="button" className="link-btn" onClick={() => trocarModo(novaConta ? 'login' : 'conta')}>
                {novaConta ? 'Entrar' : 'Criar agora'}
              </button>
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
