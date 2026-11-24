// Acesso de suporte: o administrador abre um "chamado" (com motivo) para entrar na conta de um cliente.
// O chamado registra quem entrou, por quê, quando, quanto tempo e o que foi alterado, e fica visível para o cliente.
// A sessão do administrador aponta para o chamado aberto (sessions.chamado_id); fechar o chamado devolve a conta dele.
module.exports = {
  version: 10,
  name: 'chamados_suporte',
  up(db) {
    db.exec(`
      CREATE TABLE chamados_suporte (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        motivo           TEXT    NOT NULL,
        aberto_em        TEXT    NOT NULL,
        ultima_atividade TEXT    NOT NULL,
        encerrado_em     TEXT,
        encerrado_por    TEXT CHECK (encerrado_por IN ('admin', 'tempo', 'sistema'))
      );
      CREATE INDEX idx_chamados_user ON chamados_suporte(user_id, aberto_em);

      CREATE TABLE chamado_acoes (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        chamado_id INTEGER NOT NULL REFERENCES chamados_suporte(id) ON DELETE CASCADE,
        metodo     TEXT    NOT NULL,
        caminho    TEXT    NOT NULL,
        status     INTEGER NOT NULL,
        criado_em  TEXT    NOT NULL
      );
      CREATE INDEX idx_chamado_acoes ON chamado_acoes(chamado_id);

      ALTER TABLE sessions ADD COLUMN chamado_id INTEGER REFERENCES chamados_suporte(id) ON DELETE SET NULL;
    `);
  },
};
