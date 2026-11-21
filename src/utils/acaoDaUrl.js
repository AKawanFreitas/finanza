// Links enviados por e-mail: ?redefinir=TOKEN (nova senha) e ?verificar=TOKEN (confirmar e-mail).
export function lerAcaoDaUrl() {
  const p = new URLSearchParams(window.location.search);
  if (p.get('redefinir')) return { tipo: 'redefinir', token: p.get('redefinir') };
  if (p.get('verificar')) return { tipo: 'verificar', token: p.get('verificar') };
  return null;
}
