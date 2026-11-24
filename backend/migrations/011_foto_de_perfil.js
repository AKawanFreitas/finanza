// Foto de perfil: o arquivo fica numa tabela própria, para não ser lido junto com o usuário a cada requisição.
// `users.foto_em` marca se há foto e serve de versão para o navegador atualizar o cache.
module.exports = {
  version: 11,
  name: 'foto_de_perfil',
  up(db) {
    db.exec(`
      ALTER TABLE users ADD COLUMN foto_em TEXT;
      CREATE TABLE fotos_perfil (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        tipo    TEXT NOT NULL,
        dados   BLOB NOT NULL
      );
    `);
  },
};
