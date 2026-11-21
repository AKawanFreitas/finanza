// Marco 3:
//  - recorrentes.automatico / conta_id: o servidor lança sozinho no vencimento, na conta escolhida.
//  - orcamentos: limite mensal por categoria.
//  - users.email_verificado_em / notificacoes_email: verificação de e-mail e opt-out de avisos.
//  - tokens: links de uso único (redefinir senha, verificar e-mail), guardados só como hash.
//  - notificacoes: registro de e-mails automáticos já enviados, para nunca mandar o mesmo duas vezes.
module.exports = {
  version: 4,
  name: 'automacao_orcamentos_e_email',
  up(db) {
    db.exec(`
      ALTER TABLE recorrentes ADD COLUMN automatico INTEGER NOT NULL DEFAULT 0 CHECK (automatico IN (0, 1));
      ALTER TABLE recorrentes ADD COLUMN conta_id INTEGER REFERENCES contas(id);

      ALTER TABLE users ADD COLUMN email_verificado_em TEXT;
      ALTER TABLE users ADD COLUMN notificacoes_email INTEGER NOT NULL DEFAULT 1 CHECK (notificacoes_email IN (0, 1));

      CREATE TABLE orcamentos (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        categoria_id   INTEGER NOT NULL REFERENCES categorias(id),
        valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
        UNIQUE (user_id, categoria_id)
      );

      CREATE TABLE tokens (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tipo       TEXT    NOT NULL CHECK (tipo IN ('redefinir_senha', 'verificar_email')),
        token_hash TEXT    NOT NULL UNIQUE,
        criado_em  TEXT    NOT NULL,
        expira_em  TEXT    NOT NULL,
        usado_em   TEXT
      );
      CREATE INDEX idx_tokens_user ON tokens(user_id, tipo);

      CREATE TABLE notificacoes (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tipo      TEXT    NOT NULL,
        chave     TEXT    NOT NULL,
        criado_em TEXT    NOT NULL,
        UNIQUE (user_id, tipo, chave)
      );
    `);
  },
};
