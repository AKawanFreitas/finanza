// Migrações versionadas. A versão aplicada fica em `PRAGMA user_version`.
// Para mudar o schema: crie migrations/NNN_nome.js exportando { version, name, up(db) }
// e registre abaixo. Nunca edite uma migração já publicada.
const migrations = [
  require('./001_baseline'),
  require('./002_centavos_e_categoria_id'),
  require('./003_contas_transferencias_e_vinculos'),
].sort((a, b) => a.version - b.version);

const ultimaVersao = migrations[migrations.length - 1].version;

const versaoAtual = db => db.pragma('user_version', { simple: true });

// Aplica o que falta, cada migração em sua própria transação (falhou, nada muda).
// Retorna as versões aplicadas. `antes(deVersao)` roda uma vez, antes da primeira pendente.
function migrar(db, { antes } = {}) {
  const pendentes = migrations.filter(m => m.version > versaoAtual(db));
  if (pendentes.length === 0) return [];

  if (antes) antes(versaoAtual(db));

  const aplicadas = [];
  for (const m of pendentes) {
    db.transaction(() => {
      m.up(db);
      db.pragma(`user_version = ${m.version}`);
    })();
    aplicadas.push(m.version);
  }
  return aplicadas;
}

module.exports = { migrar, migrations, ultimaVersao, versaoAtual };
