// Limitador simples em memória: no máximo `max` eventos por `janelaMs` para cada chave.
// Em memória significa que reinicia com o processo e não é compartilhado entre instâncias;
// ao escalar para várias instâncias, troque por Redis (a interface continua a mesma).
const registros = new Map();

// Registra um evento e devolve true se ainda está dentro do limite.
function permitir(chave, max, janelaMs) {
  const agora = Date.now();
  const r = registros.get(chave);
  if (!r || r.ate < agora) {
    registros.set(chave, { n: 1, ate: agora + janelaMs });
    return true;
  }
  r.n += 1;
  return r.n <= max;
}

setInterval(() => {
  const agora = Date.now();
  for (const [k, r] of registros) if (r.ate < agora) registros.delete(k);
}, 10 * 60e3).unref();

module.exports = { permitir };
