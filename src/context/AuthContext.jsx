import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const API = '/api/auth';
const AuthContext = createContext(null);

// A sessão vive num cookie httpOnly: o front nunca lê nem guarda o token.
async function pedir(caminho, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${caminho}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const dados = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(dados.error || 'Não foi possível concluir. Tente de novo.');
  return dados;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [carregando, setCarregando] = useState(true);

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

  const sair = useCallback(async () => {
    await pedir('/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
  }, []);

  const salvarPerfil = useCallback(async (nome, email) => {
    const { user } = await pedir('/perfil', { method: 'PATCH', body: { nome, email } });
    setUser(user);
  }, []);

  const trocarSenha = useCallback(async (atual, nova) => {
    const { user } = await pedir('/senha', { method: 'POST', body: { atual, nova } });
    setUser(user);
  }, []);

  const excluirConta = useCallback(async (senha) => {
    await pedir('/conta', { method: 'DELETE', body: { senha } });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, carregando, ehAdmin: user?.papel === 'superadmin',
      entrar, criarConta, sair, salvarPerfil, trocarSenha, excluirConta,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
