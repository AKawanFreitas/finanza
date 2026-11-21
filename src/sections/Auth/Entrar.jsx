import { useState } from 'react';
import { Mail, Lock, User, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Entrar() {
  const { entrar, criarConta } = useAuth();
  const [modo, setModo] = useState('login'); // 'login' | 'conta'
  const [form, setForm] = useState({ nome: '', email: '', senha: '' });
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [verSenha, setVerSenha] = useState(false);

  const novaConta = modo === 'conta';
  const set = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }));

  function trocarModo(proximo) {
    setModo(proximo);
    setErro('');
    setForm(f => ({ ...f, nome: '', senha: '' }));
    setVerSenha(false);
  }

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      if (novaConta) await criarConta(form.nome, form.email, form.senha);
      else await entrar(form.email, form.senha);
    } catch (err) {
      setErro(err.message);
      setEnviando(false);
    }
  }

  return (
    <div className="entrar">
      <section className="entrar-marca">
        <img src="/logo sem texto - finanza.png" alt="" className="entrar-logo" />
        <h1>Finanza</h1>
        <p>Acompanhe entradas, gastos e contas fixas do mês em um lugar só.</p>
      </section>

      <section className="entrar-painel">
        <form className="entrar-form" onSubmit={enviar}>
          <h2>{novaConta ? 'Criar conta' : 'Entrar na sua conta'}</h2>

          {erro && <p className="aviso-erro" role="alert">{erro}</p>}

          {novaConta && (
            <label className="form-group">
              <span className="form-label">Nome</span>
              <span className="form-input-wrap">
                <span className="form-prefix"><User size={15} strokeWidth={2} /></span>
                <input
                  className="form-control" autoComplete="name" required
                  value={form.nome} onChange={e => set('nome', e.target.value)}
                />
              </span>
            </label>
          )}

          <label className="form-group">
            <span className="form-label">E-mail</span>
            <span className="form-input-wrap">
              <span className="form-prefix"><Mail size={15} strokeWidth={2} /></span>
              <input
                className="form-control" type="email" autoComplete="email" required
                value={form.email} onChange={e => set('email', e.target.value)}
              />
            </span>
          </label>

          <label className="form-group">
            <span className="form-label">Senha</span>
            <span className="form-input-wrap">
              <span className="form-prefix"><Lock size={15} strokeWidth={2} /></span>
              <input
                className="form-control" type={verSenha ? 'text' : 'password'} required
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
            {novaConta && <span className="form-dica">Pelo menos 8 caracteres.</span>}
          </label>

          <button className="btn btn-primary btn-full" type="submit" disabled={enviando}>
            {novaConta ? <UserPlus size={16} strokeWidth={2.5} /> : <LogIn size={16} strokeWidth={2.5} />}
            {enviando ? 'Aguarde...' : novaConta ? 'Criar conta' : 'Entrar'}
          </button>

          <p className="entrar-troca">
            {novaConta ? 'Já tem conta?' : 'Ainda não tem conta?'}{' '}
            <button type="button" className="link-btn" onClick={() => trocarModo(novaConta ? 'login' : 'conta')}>
              {novaConta ? 'Entrar' : 'Criar agora'}
            </button>
          </p>
        </form>
      </section>
    </div>
  );
}
