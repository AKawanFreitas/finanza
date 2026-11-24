import { useState } from 'react';
import { Lock, Check, KeyRound, Info, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import EntrarMarca from '../../components/EntrarMarca';

// Mostrada quando o administrador redefiniu a senha: a pessoa entra com a
// provisória e só chega ao app depois de escolher uma senha própria.
export default function TrocarSenha() {
  const { user, trocarSenha, sair } = useAuth();
  const [atual, setAtual] = useState('');
  const [nova, setNova]   = useState('');
  const [erro, setErro]   = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await trocarSenha(atual, nova);
    } catch (err) {
      setErro(err.message);
      setEnviando(false);
    }
  }

  return (
    <div className="entrar">
      <EntrarMarca subtitulo="Defina uma senha sua para continuar." />

      <section className="entrar-painel">
        <form className="entrar-form" onSubmit={enviar}>
          <span className="entrar-selo" aria-hidden="true"><img src="/logo sem texto - finanza.png" alt="" /></span>
          <h2>Nova senha</h2>
          <p className="entrar-nota">A senha de {user.email} foi redefinida pelo administrador.</p>

          {erro && <p className="aviso-erro" role="alert">{erro}</p>}

          <label className="form-group">
            <span className="form-label"><Lock size={16} />Senha provisória</span>
            <span className="form-input-wrap">
              <span className="form-prefix"><Lock size={16} strokeWidth={2} /></span>
              <input
                className="form-control" type="password" autoComplete="current-password" required
                value={atual} onChange={e => setAtual(e.target.value)}
              />
            </span>
          </label>

          <label className="form-group">
            <span className="form-label"><KeyRound size={16} />Nova senha</span>
            <span className="form-input-wrap">
              <span className="form-prefix"><Lock size={16} strokeWidth={2} /></span>
              <input
                className="form-control" type="password" autoComplete="new-password" required minLength={8}
                value={nova} onChange={e => setNova(e.target.value)}
              />
            </span>
            <span className="form-dica"><Info size={14} />Pelo menos 8 caracteres.</span>
          </label>

          <button className="btn btn-primary btn-full" type="submit" disabled={enviando}>
            <Check size={16} strokeWidth={2.5} />
            {enviando ? 'Salvando...' : 'Salvar e continuar'}
            <ArrowRight size={16} strokeWidth={2.5} />
          </button>

          <p className="entrar-troca">
            <button type="button" className="link-btn" onClick={sair}>Sair</button>
          </p>
        </form>
      </section>
    </div>
  );
}
