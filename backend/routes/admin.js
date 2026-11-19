const express = require('express');
const router  = express.Router();
const db      = require('../db');
const auth    = require('../lib/auth');

router.use(auth.exigirLogin, auth.exigirAdmin);

const LISTA = `
  SELECT u.id, u.nome, u.email, u.papel, u.status, u.trocar_senha, u.criado_em, u.ultimo_acesso,
         (SELECT COUNT(*) FROM transactions t WHERE t.user_id = u.id) AS lancamentos
  FROM users u
  WHERE (:busca = '' OR u.nome LIKE :like OR u.email LIKE :like)
  ORDER BY u.criado_em DESC
`;

/* ── Usuários ───────────────────────────────────────── */
router.get('/usuarios', (req, res) => {
  const busca = typeof req.query.busca === 'string' ? req.query.busca.trim() : '';
  const linhas = db.prepare(LISTA).all({ busca, like: `%${busca}%` });
  res.json(linhas.map(u => ({ ...u, trocar_senha: !!u.trocar_senha })));
});

/* ── Métricas ───────────────────────────────────────── */
router.get('/metricas', (req, res) => {
  const agora = new Date();
  const mes   = agora.toISOString().slice(0, 7);
  const umMesAtras = new Date(agora.getTime() - 30 * 864e5).toISOString();

  res.json({
    usuarios:  db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
    ativos:    db.prepare("SELECT COUNT(*) AS n FROM users WHERE status = 'ativo'").get().n,
    suspensos: db.prepare("SELECT COUNT(*) AS n FROM users WHERE status = 'suspenso'").get().n,
    novosNoMes: db.prepare('SELECT COUNT(*) AS n FROM users WHERE substr(criado_em, 1, 7) = ?').get(mes).n,
    acessaram30d: db.prepare('SELECT COUNT(*) AS n FROM users WHERE ultimo_acesso >= ?').get(umMesAtras).n,
    lancamentos: db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n,
    sessoesAbertas: db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE expira_em > ?').get(agora.toISOString()).n,
  });
});

// O admin não pode suspender, excluir nem redefinir a própria conta por engano.
function alvo(req, res) {
  const id = Number(req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) { res.status(404).json({ error: 'Usuário não encontrado.' }); return null; }
  if (id === req.user.id) { res.status(400).json({ error: 'Use a página de configurações para a sua própria conta.' }); return null; }
  return user;
}

/* ── Suspender e reativar ───────────────────────────── */
router.patch('/usuarios/:id/status', (req, res) => {
  const user = alvo(req, res);
  if (!user) return;

  const status = req.body?.status;
  if (status !== 'ativo' && status !== 'suspenso') {
    return res.status(400).json({ error: 'O status deve ser "ativo" ou "suspenso".' });
  }

  const aplicar = db.transaction(() => {
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, user.id);
    // Suspender derruba as sessões abertas na hora.
    if (status === 'suspenso') auth.encerrarSessoesDe(user.id);
  });
  aplicar();
  res.json({ id: user.id, status });
});

/* ── Redefinir senha ────────────────────────────────── */
router.post('/usuarios/:id/senha', (req, res) => {
  const user = alvo(req, res);
  if (!user) return;

  const provisoria = auth.senhaProvisoria();
  const aplicar = db.transaction(() => {
    db.prepare('UPDATE users SET senha_hash = ?, trocar_senha = 1 WHERE id = ?')
      .run(auth.hashSenha(provisoria), user.id);
    auth.encerrarSessoesDe(user.id);
  });
  aplicar();

  // A senha provisória aparece uma única vez, aqui. Entregue-a à pessoa por um canal seguro.
  res.json({ id: user.id, email: user.email, senha_provisoria: provisoria });
});

/* ── Excluir usuário ────────────────────────────────── */
router.delete('/usuarios/:id', (req, res) => {
  const user = alvo(req, res);
  if (!user) return;
  if (user.papel === 'superadmin') {
    return res.status(400).json({ error: 'Não é possível excluir outro administrador.' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  res.json({ ok: true });
});

module.exports = router;
