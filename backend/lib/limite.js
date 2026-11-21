// Limitador de tentativas guardado no SQLite: no máximo `max` eventos por `janelaMs` para cada chave.
// Como o estado fica no banco, reiniciar a API não zera os contadores e várias instâncias que
// compartilham o arquivo enxergam o mesmo limite.
const db = require('../db');

const agora = () => Date.now();

// Soma um evento à chave (abrindo uma janela nova se a anterior expirou) e devolve o total na janela.
const registrar = db.transaction((chave, janelaMs) => {
  const t = agora();
  const r = db.prepare('SELECT n, ate FROM limites WHERE chave = ?').get(chave);
  if (!r || r.ate < t) {
    db.prepare('INSERT OR REPLACE INTO limites (chave, n, ate) VALUES (?, 1, ?)').run(chave, t + janelaMs);
    return 1;
  }
  db.prepare('UPDATE limites SET n = n + 1 WHERE chave = ?').run(chave);
  return r.n + 1;
});

// Registra um evento e diz se ainda está dentro do limite.
const permitir = (chave, max, janelaMs) => registrar(chave, janelaMs) <= max;

// Quantos minutos faltam para a chave sair do bloqueio (0 se não está bloqueada). Não conta como evento.
function minutosBloqueado(chave, max) {
  const r = db.prepare('SELECT n, ate FROM limites WHERE chave = ?').get(chave);
  if (!r || r.ate < agora() || r.n < max) return 0;
  return Math.max(1, Math.ceil((r.ate - agora()) / 60e3));
}

const limpar = chave => db.prepare('DELETE FROM limites WHERE chave = ?').run(chave);
const limparExpirados = () => db.prepare('DELETE FROM limites WHERE ate < ?').run(agora()).changes;

module.exports = { permitir, registrar, minutosBloqueado, limpar, limparExpirados };
