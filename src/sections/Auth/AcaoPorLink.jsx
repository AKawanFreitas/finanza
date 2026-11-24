import { useEffect, useRef, useState } from 'react';
import { Lock, Check, MailCheck, AlertTriangle, Info } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import EntrarMarca from '../../components/EntrarMarca';

// Telas abertas por links enviados por e-mail: ?redefinir=TOKEN e ?verificar=TOKEN.
// Funcionam com ou sem sessão aberta.
const limparUrl = () => window.history.replaceState({}, '', window.location.pathname);

function Moldura({ titulo, children }) {
  return (
    <div className="entrar tema-claro">
      <EntrarMarca />
      <section className="entrar-painel">
        <div className="entrar-form">
          <span className="entrar-selo" aria-hidden="true"><img src="/logo sem texto - finanza.png" alt="" /></span>
          <h2>{titulo}</h2>
          {children}
        </div>
      </section>
    </div>
  );
}

function RedefinirSenha({ token, onConcluir }) {
  const { redefinirSenha } = useAuth();
  const [nova, setNova] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await redefinirSenha(token, nova);
      setPronto(true);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (pronto) {
    return (
      <Moldura titulo="Senha alterada">
        <p className="aviso-ok" role="status"><Check size={15} strokeWidth={2.5} style={{ verticalAlign: '-2px' }} /> Pronto! Sua senha foi redefinida e as outras sessões foram encerradas.</p>
        <button className="btn btn-primary btn-full" onClick={onConcluir}>Entrar com a nova senha</button>
      </Moldura>
    );
  }

  return (
    <Moldura titulo="Escolha uma nova senha">
      <form className="entrar-form-interno" onSubmit={enviar}>
        {erro && <p className="aviso-erro" role="alert">{erro}</p>}
        <label className="form-group">
          <span className="form-label"><Lock size={16} />Nova senha</span>
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
          <Check size={16} strokeWidth={2.5} /> {enviando ? 'Salvando...' : 'Salvar nova senha'}
        </button>
        <p className="entrar-troca"><button type="button" className="link-btn" onClick={onConcluir}>Cancelar</button></p>
      </form>
    </Moldura>
  );
}

function VerificarEmail({ token, onConcluir }) {
  const { verificarEmail } = useAuth();
  const [estado, setEstado] = useState({ fase: 'verificando', erro: '' });
  // O token é de uso único: o pedido sai uma vez só, mesmo com o StrictMode executando o efeito em dobro.
  const enviado = useRef(false);

  useEffect(() => {
    if (enviado.current) return;
    enviado.current = true;
    verificarEmail(token)
      .then(() => setEstado({ fase: 'ok', erro: '' }))
      .catch(err => setEstado({ fase: 'erro', erro: err.message }));
  }, [token, verificarEmail]);

  return (
    <Moldura titulo="Confirmação de e-mail">
      {estado.fase === 'verificando' && <p>Confirmando seu e-mail...</p>}
      {estado.fase === 'ok' && (
        <p className="aviso-ok" role="status"><MailCheck size={15} strokeWidth={2.5} style={{ verticalAlign: '-2px' }} /> E-mail confirmado! Você já pode receber alertas e resumos.</p>
      )}
      {estado.fase === 'erro' && (
        <p className="aviso-erro" role="alert"><AlertTriangle size={15} strokeWidth={2.5} style={{ verticalAlign: '-2px' }} /> {estado.erro}</p>
      )}
      {estado.fase !== 'verificando' && <button className="btn btn-primary btn-full" onClick={onConcluir}>Continuar</button>}
    </Moldura>
  );
}

export default function AcaoPorLink({ acao, onConcluir }) {
  const concluir = () => { limparUrl(); onConcluir(); };
  return acao.tipo === 'redefinir'
    ? <RedefinirSenha token={acao.token} onConcluir={concluir} />
    : <VerificarEmail token={acao.token} onConcluir={concluir} />;
}
