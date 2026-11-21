// Limites de tentativas (login, recuperação de senha) passam da memória para o banco:
// sobrevivem a reinícios e valem para todas as instâncias que usam o mesmo arquivo.
module.exports = {
  version: 5,
  name: 'limites',
  up(db) {
    db.exec(`
      CREATE TABLE limites (
        chave TEXT    PRIMARY KEY,
        n     INTEGER NOT NULL,
        ate   INTEGER NOT NULL
      );
      CREATE INDEX idx_limites_ate ON limites(ate);
    `);
  },
};
