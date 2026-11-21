const db = require('../db');

// Resolve a categoria informada (id ou nome) dentro das categorias DO usuário.
// Nunca aceita categoria de outra conta.
function resolverCategoria(userId, { categoria_id, cat }) {
  const cate = categoria_id !== undefined
    ? db.prepare('SELECT id, nome FROM categorias WHERE id = ? AND user_id = ?').get(categoria_id, userId)
    : db.prepare('SELECT id, nome FROM categorias WHERE nome = ? COLLATE NOCASE AND user_id = ?').get(cat, userId);
  return cate || null;
}

module.exports = { resolverCategoria };
