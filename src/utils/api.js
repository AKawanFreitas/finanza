// Cliente da API. Sessão expirada (401) recarrega a página para cair no login.
// Devolve { ok, status, data }; `data` é o JSON da resposta (ou null).
export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    window.location.reload();
    throw new Error('Sessão encerrada.');
  }
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

// '?a=1&b=2' só com os valores preenchidos.
export function query(params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== '' && v != null) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : '';
}
