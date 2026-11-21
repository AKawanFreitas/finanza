// Cliente da API. Sessão expirada (401) recarrega a página para cair no login.
// Devolve { ok, status, data }; `data` é o JSON da resposta (ou null). Falha de conexão vira
// { ok: false, status: 0, data: { error } }, para as telas mostrarem a mesma mensagem de sempre.
export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Sem rede ou com a API parada o fetch lança TypeError ("NetworkError..."): devolve uma mensagem clara.
    return { ok: false, status: 0, data: { error: 'Não consegui falar com o servidor. Confira se a API está rodando.' } };
  }
  if (res.status === 401) {
    window.location.reload();
    throw new Error('Sessão encerrada.');
  }
  const data = await res.json().catch(() => null);
  // Com a API parada, o proxy do Vite responde um 5xx sem corpo JSON.
  if (res.status >= 500 && !data?.error) return { ok: false, status: res.status, data: { error: 'Não consegui falar com o servidor. Confira se a API está rodando.' } };
  return { ok: res.ok, status: res.status, data };
}

// '?a=1&b=2' só com os valores preenchidos.
export function query(params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== '' && v != null) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : '';
}
