// Cada categoria passa a ter um ícone, escolhido pela pessoa. As categorias padrão que já existem
// ganham o ícone que combina com o nome; as demais ficam com o ícone genérico.
const ICONE_POR_NOME = {
  'Alimentação': 'utensils', 'Moradia': 'home', 'Transporte': 'car', 'Saúde': 'heart-pulse',
  'Lazer': 'gamepad-2', 'Renda': 'wallet', 'Educação': 'graduation-cap',
};

module.exports = {
  version: 9,
  name: 'icone_da_categoria',
  up(db) {
    db.exec("ALTER TABLE categorias ADD COLUMN icone TEXT NOT NULL DEFAULT 'tag'");
    const atualizar = db.prepare('UPDATE categorias SET icone = ? WHERE nome = ?');
    for (const [nome, icone] of Object.entries(ICONE_POR_NOME)) atualizar.run(icone, nome);
  },
};
