// Tarefas periódicas, no próprio processo da API: sem dependência de cron externo.
// Cada tarefa é idempotente, então rodar duas vezes (ou em duas instâncias) não duplica nada.
// Ao escalar para várias instâncias, rode isto em um único processo "worker".
const db = require('../db');
const { executarAutomaticos } = require('./recorrentes');
const { enviarResumosMensais } = require('./resumoMensal');
const { limparExpiradas } = require('./auth');
const { backupDoDia } = require('./backup');
const { limparExpirados } = require('./limite');
const logger = require('./logger');

const INTERVALO_MS = 60 * 60e3;

function rodarTarefas(agora = new Date()) {
  const resultado = { lancados: 0, resumos: 0, backup: null };
  const tentar = (nome, fn) => { try { return fn(); } catch (err) { logger.error({ err, tarefa: nome }, 'falha em tarefa agendada'); return 0; } };

  tentar('sessões', limparExpiradas);
  tentar('tokens', () => db.prepare('DELETE FROM tokens WHERE expira_em < ? OR usado_em IS NOT NULL').run(agora.toISOString()));
  tentar('limites', limparExpirados);
  resultado.lancados = tentar('recorrentes automáticos', () => executarAutomaticos(agora));
  resultado.resumos  = tentar('resumo mensal', () => enviarResumosMensais(agora));
  const feito = tentar('backup', () => backupDoDia(agora));
  if (feito) resultado.backup = feito.arquivo;
  return resultado;
}

function iniciarAgendador() {
  const r = rodarTarefas();
  if (r.lancados || r.resumos || r.backup) logger.info(r, 'tarefas agendadas executadas');
  setInterval(() => rodarTarefas(), INTERVALO_MS).unref();
}

module.exports = { rodarTarefas, iniciarAgendador };
