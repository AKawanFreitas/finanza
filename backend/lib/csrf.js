// Defesa contra CSRF (um site de terceiros fazendo o navegador da pessoa chamar a API com o cookie dela).
// A sessão já usa SameSite=Lax; aqui acrescentamos a checagem de origem, recomendada pela OWASP:
// em requisições que alteram dados, o navegador sempre manda o cabeçalho Origin, e ele precisa ser o
// próprio app (mesmo host), o APP_URL ou uma origem de CORS_ORIGIN. Sem Origin (curl, testes, servidor a
// servidor) a requisição passa, porque CSRF só existe com navegador, e o navegador envia Origin ou Sec-Fetch-Site.
const SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

const lista = valor => String(valor || '').split(',').map(s => s.trim()).filter(Boolean);
const hostDe = url => { try { return new URL(url).host; } catch { return null; } };

function permitidos() {
  const hosts = new Set();
  for (const o of [...lista(process.env.CORS_ORIGIN), process.env.APP_URL]) {
    const h = o && hostDe(o);
    if (h) hosts.add(h);
  }
  return hosts;
}

function protegerCsrf(req, res, next) {
  if (SEGUROS.has(req.method)) return next();

  const negar = () => res.status(403).json({ error: 'Origem não permitida.' });
  const origin = req.get('origin');

  if (origin) {
    const host = origin === 'null' ? null : hostDe(origin);
    if (!host) return negar();
    if (host === req.get('host') || permitidos().has(host)) return next();
    return negar();
  }

  // Sem Origin: navegadores modernos ainda dizem de onde veio pelo Sec-Fetch-Site.
  const site = req.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return negar();
  next();
}

module.exports = { protegerCsrf };
