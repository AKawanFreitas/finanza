// Acesso de suporte: o administrador abre um chamado (com motivo) para entrar na conta de um cliente.
// Enquanto o chamado está aberto, a sessão dele age como o cliente; sem atividade por 1 minuto, o chamado fecha
// sozinho. O cliente vê um aviso enquanto isso e, depois, o histórico do que foi feito.
const express = require('express');
const router  = express.Router();
const db      = require('../db');
const auth    = require('../lib/auth');
const suporte = require('../lib/suporte');

router.use(auth.exigirLogin);

const MOTIVO_MIN = 5;
const MOTIVO_MAX = 300;

/* ── Abrir um chamado (administrador) ───────────────── */
router.post('/chamados', (req, res) => {
  if (req.user.suporte) return res.status(409).json({ error: 'Encerre o chamado atual antes de abrir outro.' });
  if (req.user.papel !== 'superadmin') return res.status(403).json({ error: 'Esta área é restrita ao administrador.' });

  const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim().replace(/\s+/g, ' ') : '';
  if (motivo.length < MOTIVO_MIN) return res.status(400).json({ error: 'Descreva o motivo do acesso (pelo menos 5 caracteres).' });
  if (motivo.length > MOTIVO_MAX) return res.status(400).json({ error: `O motivo deve ter até ${MOTIVO_MAX} caracteres.` });

  const alvo = db.prepare('SELECT id, papel, status FROM users WHERE id = ?').get(Number(req.body?.user_id));
  if (!alvo) return res.status(404).json({ error: 'Usuário não encontrado.' });
  if (alvo.papel === 'superadmin') return res.status(400).json({ error: 'Não é possível abrir chamado em conta de administrador.' });
  if (alvo.status !== 'ativo') return res.status(400).json({ error: 'A conta está suspensa. Reative-a antes de abrir um chamado.' });

  suporte.encerrarVencidos();
  if (suporte.chamadoAbertoDe(alvo.id)) return res.status(409).json({ error: 'Já existe um chamado aberto para esta conta.' });

  const id = db.transaction(() => {
    const novo = suporte.abrir(req.user.id, alvo.id, motivo);
    auth.vincularSessao(req.user.token, novo);
    return novo;
  })();
  res.status(201).json({ chamado_id: id });
});

/* ── Renovar o tempo (a tela avisa a cada atividade) ── */
router.post('/renovar', (req, res) => {
  if (!req.user.suporte) return res.json({ ativo: false });
  suporte.renovar(req.user.suporte.chamado.id);
  const atual = suporte.chamadoAberto(req.user.suporte.chamado.id);
  res.json({ ativo: true, expira_em: suporte.expiraEm(atual), agora: new Date().toISOString() });
});

/* ── Encerrar o chamado ─────────────────────────────── */
router.post('/encerrar', (req, res) => {
  if (!req.user.suporte) return res.json({ ok: true, ativo: false });
  suporte.encerrar(req.user.suporte.chamado.id, 'admin');
  res.json({ ok: true });
});

/* ── Aviso ao cliente: há um acesso de suporte agora? ─ */
router.get('/aviso', (req, res) => {
  suporte.encerrarVencidos();
  if (req.user.suporte) return res.json({ aviso: null });
  const c = db.prepare(`
    SELECT c.id, c.motivo, c.aberto_em, a.nome AS admin_nome
    FROM chamados_suporte c JOIN users a ON a.id = c.admin_id
    WHERE c.user_id = ? AND c.encerrado_em IS NULL
  `).get(req.user.id);
  res.json({ aviso: c ?? null });
});

/* ── Histórico dos acessos de suporte à conta ───────── */
router.get('/historico', (req, res) => {
  suporte.encerrarVencidos();
  res.json(suporte.historico(req.user.id));
});

module.exports = router;
