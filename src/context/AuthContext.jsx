import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const API = '/api/auth';
const AuthContext = createContext(null);

// A sessão vive num cookie httpOnly: o front nunca lê nem guarda o token.
async function pedir(caminho, { method = 'GET', body, arquivo } = {}) {
  let res;
  try {
    res = await fetch(`${API}${caminho}`, {
      method,
      credentials: 'same-origin',
      // `arquivo` é um Blob enviado como veio (foto de perfil); o resto vai como JSON.
      headers: arquivo ? { 'Content-Type': arquivo.type } : body ? { 'Content-Type': 'application/json' } : undefined,
      body: arquivo ?? (body ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new Error('Não consegui falar com o servidor. Confira se a API está rodando.');
  }
  const dados = await res.json().catch(() => ({}));
  // Com a API parada, o proxy do Vite responde um 5xx sem corpo JSON.
  if (res.status >= 500 && !dados.error) throw new Error('Não consegui falar com o servidor. Confira se a API está rodando.');
  if (!res.ok) throw new Error(dados.error || 'Não foi possível concluir. Tente de novo.');
  return dados;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [carregando, setCarregando] = useState(true);
  // Último acesso de suporte que terminou, para o administrador ver por que voltou à conta dele.
  const [fimSuporte, setFimSuporte] = useState(null);
  const userRef = useRef(null);
  userRef.current = user;

  useEffect(() => {
    pedir('/eu')
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setCarregando(false));
  }, []);

  const entrar = useCallback(async (email, senha) => {
    const { user } = await pedir('/login', { method: 'POST', body: { email, senha } });
    setUser(user);
  }, []);

  const criarConta = useCallback(async (nome, email, senha) => {
    const { user } = await pedir('/registrar', { method: 'POST', body: { nome, email, senha } });
    setUser(user);
  }, []);

  // Busca de novo quem está logado (e se há um acesso de suporte em andamento).
  const recarregar = useCallback(() => pedir('/eu').then(({ user }) => setUser(user)).catch(() => {}), []);

  // Sair durante um acesso de suporte só encerra o acesso: o administrador volta à conta dele.
  const sair = useCallback(async () => {
    const r = await pedir('/logout', { method: 'POST' }).catch(() => ({}));
    if (r.suporte_encerrado) {
      setFimSuporte({ cliente: userRef.current?.suporte?.cliente?.nome ?? '', motivo: 'admin' });
      await recarregar();
      return;
    }
    setUser(null);
  }, [recarregar]);

  // O contador chegou a zero: confere no servidor e avisa o administrador por que a conta mudou.
  const suporteExpirou = useCallback(async () => {
    setFimSuporte({ cliente: userRef.current?.suporte?.cliente?.nome ?? '', motivo: 'tempo' });
    await recarregar();
  }, [recarregar]);

  // `senha` só é exigida pela API quando o e-mail muda.
  const salvarPerfil = useCallback(async (nome, email, senha) => {
    const { user } = await pedir('/perfil', { method: 'PATCH', body: { nome, email, ...(senha ? { senha } : {}) } });
    setUser(user);
  }, []);

  const trocarSenha = useCallback(async (atual, nova) => {
    const { user } = await pedir('/senha', { method: 'POST', body: { atual, nova } });
    setUser(user);
  }, []);

  const salvarFoto = useCallback(async (arquivo) => {
    const { user } = await pedir('/foto', { method: 'PUT', arquivo });
    setUser(user);
  }, []);

  const removerFoto = useCallback(async () => {
    const { user } = await pedir('/foto', { method: 'DELETE' });
    setUser(user);
  }, []);

  const salvarPreferencias = useCallback(async (notificacoes_email) => {
    const { user } = await pedir('/preferencias', { method: 'PATCH', body: { notificacoes_email } });
    setUser(user);
  }, []);

  // Recuperação de senha e confirmação de e-mail funcionam sem sessão (o link vem por e-mail).
  const esqueciSenha  = useCallback(email => pedir('/esqueci-senha', { method: 'POST', body: { email } }), []);
  const redefinirSenha = useCallback((token, nova) => pedir('/redefinir-senha', { method: 'POST', body: { token, nova } }), []);
  const verificarEmail = useCallback(async (token) => {
    await pedir('/verificar-email', { method: 'POST', body: { token } });
    // Se a pessoa já está logada, o aviso de "confirme seu e-mail" some.
    pedir('/eu').then(({ user }) => setUser(user)).catch(() => {});
  }, []);
  const reenviarVerificacao = useCallback(() => pedir('/reenviar-verificacao', { method: 'POST' }), []);

  const excluirConta = useCallback(async (senha) => {
    await pedir('/conta', { method: 'DELETE', body: { senha } });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, carregando, ehAdmin: user?.papel === 'superadmin',
      recarregar, fimSuporte, limparFimSuporte: () => setFimSuporte(null), suporteExpirou,
      entrar, criarConta, sair, salvarPerfil, trocarSenha, excluirConta,
      salvarPreferencias, salvarFoto, removerFoto, esqueciSenha, redefinirSenha, verificarEmail, reenviarVerificacao,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
