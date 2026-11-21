// Marco 2:
//  - contas (carteiras): todo lançamento passa a pertencer a uma conta; cada usuário ganha "Conta principal".
//  - transferencias entre contas (não entram como receita/gasto).
//  - transactions.recorrente_id: liga o lançamento ao recorrente que o gerou (lançar sem duplicar, no servidor).
//  - transactions.id_externo: id do banco (FITID do OFX) para não importar o mesmo extrato duas vezes.
//  - FKs de categoria/conta passam de RESTRICT para NO ACTION. RESTRICT dispara na hora e pode barrar a
//    exclusão em cascata de um usuário (depende da ordem em que o SQLite apaga as tabelas filhas);
//    NO ACTION confere só no fim do comando, quando a cascata já terminou.
module.exports = {
  version: 3,
  name: 'contas_transferencias_e_vinculos',
  up(db) {
    const agora = new Date().toISOString();

    db.exec(`
      CREATE TABLE contas (
        id                     INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id                INTEGER REFERENCES users(id) ON DELETE CASCADE,
        nome                   TEXT    NOT NULL,
        tipo                   TEXT    NOT NULL CHECK (tipo IN ('corrente', 'poupanca', 'carteira', 'investimento')),
        cor                    TEXT    NOT NULL DEFAULT '#4d9fff',
        saldo_inicial_centavos INTEGER NOT NULL DEFAULT 0,
        arquivada              INTEGER NOT NULL DEFAULT 0 CHECK (arquivada IN (0, 1)),
        criado_em              TEXT    NOT NULL,
        UNIQUE (user_id, nome)
      );
      CREATE INDEX idx_contas_user ON contas(user_id);
    `);

    db.prepare(`INSERT INTO contas (user_id, nome, tipo, criado_em) SELECT id, 'Conta principal', 'corrente', ? FROM users`).run(agora);
    // Dados órfãos (anteriores às contas de usuário) também precisam de uma conta, até serem adotados.
    db.prepare(`
      INSERT INTO contas (user_id, nome, tipo, criado_em)
      SELECT NULL, 'Conta principal', 'corrente', ?
      WHERE EXISTS (SELECT 1 FROM transactions WHERE user_id IS NULL)
    `).run(agora);

    db.exec(`
      CREATE TABLE transactions_nova (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id        INTEGER REFERENCES users(id) ON DELETE CASCADE,
        conta_id       INTEGER NOT NULL REFERENCES contas(id),
        recorrente_id  INTEGER REFERENCES recorrentes(id) ON DELETE SET NULL,
        descricao      TEXT    NOT NULL,
        valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
        tipo           TEXT    NOT NULL CHECK (tipo IN ('entrada', 'saida')),
        categoria_id   INTEGER NOT NULL REFERENCES categorias(id),
        data           TEXT    NOT NULL CHECK (data GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        obs            TEXT    NOT NULL DEFAULT '',
        id_externo     TEXT
      );

      INSERT INTO transactions_nova (id, user_id, conta_id, descricao, valor_centavos, tipo, categoria_id, data, obs)
      SELECT t.id, t.user_id,
             (SELECT c.id FROM contas c WHERE c.user_id IS t.user_id ORDER BY c.id LIMIT 1),
             t.descricao, t.valor_centavos, t.tipo, t.categoria_id, t.data, t.obs
      FROM transactions t;

      DROP TABLE transactions;
      ALTER TABLE transactions_nova RENAME TO transactions;

      CREATE TABLE recorrentes_nova (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id        INTEGER REFERENCES users(id) ON DELETE CASCADE,
        nome           TEXT    NOT NULL,
        valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
        tipo           TEXT    NOT NULL CHECK (tipo IN ('fixo', 'recorrente')),
        categoria_id   INTEGER NOT NULL REFERENCES categorias(id),
        dia            INTEGER NOT NULL CHECK (dia BETWEEN 1 AND 31),
        obs            TEXT    NOT NULL DEFAULT ''
      );
      INSERT INTO recorrentes_nova SELECT id, user_id, nome, valor_centavos, tipo, categoria_id, dia, obs FROM recorrentes;
      DROP TABLE recorrentes;
      ALTER TABLE recorrentes_nova RENAME TO recorrentes;
    `);

    // Lançamentos já feitos a partir de um recorrente (mesmo nome e categoria, no mês) passam a apontar para ele.
    // Só o primeiro de cada recorrente por mês, para nunca haver dois no mesmo mês.
    const candidatos = db.prepare(`
      SELECT t.id AS tid, r.id AS rid, substr(t.data, 1, 7) AS mes
      FROM transactions t
      JOIN recorrentes r ON r.user_id IS t.user_id AND r.nome = t.descricao AND r.categoria_id = t.categoria_id
      WHERE t.tipo = 'saida'
      ORDER BY t.id
    `).all();
    const vistos = new Set();
    const ligar  = db.prepare('UPDATE transactions SET recorrente_id = ? WHERE id = ?');
    for (const { tid, rid, mes } of candidatos) {
      const chave = `${rid}|${mes}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      ligar.run(rid, tid);
    }

    db.exec(`
      CREATE TABLE transferencias (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        origem_id      INTEGER NOT NULL REFERENCES contas(id),
        destino_id     INTEGER NOT NULL REFERENCES contas(id),
        valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
        data           TEXT    NOT NULL CHECK (data GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        descricao      TEXT    NOT NULL DEFAULT '',
        CHECK (origem_id <> destino_id)
      );

      CREATE INDEX idx_transactions_user_data ON transactions(user_id, data);
      CREATE INDEX idx_transactions_categoria ON transactions(categoria_id);
      CREATE INDEX idx_transactions_conta     ON transactions(conta_id);
      CREATE INDEX idx_transactions_recorr    ON transactions(recorrente_id);
      CREATE UNIQUE INDEX idx_transactions_externo ON transactions(conta_id, id_externo) WHERE id_externo IS NOT NULL;
      CREATE INDEX idx_recorrentes_user       ON recorrentes(user_id);
      CREATE INDEX idx_recorrentes_categoria  ON recorrentes(categoria_id);
      CREATE INDEX idx_transferencias_user    ON transferencias(user_id, data);
      CREATE INDEX idx_transferencias_origem  ON transferencias(origem_id);
      CREATE INDEX idx_transferencias_destino ON transferencias(destino_id);
    `);
  },
};
