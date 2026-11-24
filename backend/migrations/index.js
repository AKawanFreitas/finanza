// Migrações versionadas. A versão aplicada fica em `PRAGMA user_version`.
// Para mudar o schema: crie migrations/NNN_nome.js exportando { version, name, up(db) }
// e registre abaixo. Nunca edite uma migração já publicada.
const migrations = [
  require('./001_baseline'),
  require('./002_centavos_e_categoria_id'),
  require('./003_contas_transferencias_e_vinculos'),
  require('./004_automacao_orcamentos_e_email'),
  require('./005_limites'),
  require('./006_cartao_de_credito'),
  require('./007_metas'),
  require('./008_contas_a_pagar'),
  require('./009_icone_da_categoria'),
  require('./010_chamados_suporte'),
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
    // Reconstruir uma tabela que outras referenciam (para mudar um CHECK, por exemplo) exige o procedimento
    // oficial do SQLite: FKs desligadas (só se muda fora de transação), mudança, conferência de integridade
    // ainda dentro da transação, e FKs religadas aconteça o que acontecer.
    const reconstroi = !!m.reconstroiTabelaPai;
    if (reconstroi) db.pragma('foreign_keys = OFF');
    try {
      db.transaction(() => {
        m.up(db);
        if (reconstroi) {
          const quebradas = db.pragma('foreign_key_check');
          if (quebradas.length) throw new Error(`Migração ${m.version} deixaria ${quebradas.length} chave(s) estrangeira(s) inválida(s).`);
        }
        db.pragma(`user_version = ${m.version}`);
      })();
    } finally {
      if (reconstroi) db.pragma('foreign_keys = ON');
    }
    aplicadas.push(m.version);
  }
  return aplicadas;
}

module.exports = { migrar, migrations, ultimaVersao, versaoAtual };
