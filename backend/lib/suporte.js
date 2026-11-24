// Acesso de suporte (chamados): o administrador entra na conta de um cliente com um motivo registrado.
// Só aqui ficam as regras de tempo e de registro; lib/auth.js usa estas funções para resolver quem é o usuário da requisição.
const db = require('../db');

// Sem atividade por este tempo, o chamado fecha sozinho e o administrador volta para a conta dele.
const ociosoMs = () => Number(process.env.SUPORTE_OCIOSO_MS) || 60_000;
const agora = () => new Date().toISOString();

const expiraEm = ch => new Date(Date.parse(ch.ultima_atividade) + ociosoMs()).toISOString();
const vencido = ch => Date.parse(ch.ultima_atividade) + ociosoMs() < Date.now();

const chamadoAberto = id => db.prepare('SELECT * FROM chamados_suporte WHERE id = ? AND encerrado_em IS NULL').get(id);
const chamadoAbertoDe = userId => db.prepare('SELECT * FROM chamados_suporte WHERE user_id = ? AND encerrado_em IS NULL').get(userId);

function encerrar(id, por) {
  const r = db.prepare('UPDATE chamados_suporte SET encerrado_em = ?, encerrado_por = ? WHERE id = ? AND encerrado_em IS NULL').run(agora(), por, id);
  db.prepare('UPDATE sessions SET chamado_id = NULL WHERE chamado_id = ?').run(id);
  return r.changes > 0;
}

// Fecha os chamados parados há mais do que o limite (por exemplo, o administrador fechou a aba).
function encerrarVencidos() {
  const corte = new Date(Date.now() - ociosoMs()).toISOString();
  for (const { id } of db.prepare('SELECT id FROM chamados_suporte WHERE encerrado_em IS NULL AND ultima_atividade < ?').all(corte)) {
    encerrar(id, 'tempo');
  }
}

const renovar = id => db.prepare('UPDATE chamados_suporte SET ultima_atividade = ? WHERE id = ? AND encerrado_em IS NULL').run(agora(), id);

function abrir(adminId, userId, motivo) {
  const t = agora();
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO chamados_suporte (admin_id, user_id, motivo, aberto_em, ultima_atividade) VALUES (?, ?, ?, ?, ?)'
  ).run(adminId, userId, motivo, t, t);
  return Number(lastInsertRowid);
}

/* ── O que foi feito ─────────────────────────────────── */

// Rotas que o administrador não pode usar dentro da conta do cliente: dados de acesso e a própria conta.
const BLOQUEADAS = [
  ['POST', '/api/auth/senha'], ['DELETE', '/api/auth/conta'], ['PATCH', '/api/auth/perfil'],
  ['PATCH', '/api/auth/preferencias'], ['POST', '/api/auth/reenviar-verificacao'],
  ['PUT', '/api/auth/foto'], ['DELETE', '/api/auth/foto'],
];
const bloqueada = (metodo, caminho) => BLOQUEADAS.some(([m, c]) => m === metodo && c === caminho);
const MENSAGEM_BLOQUEIO = 'Durante o acesso de suporte não é possível alterar a senha, o e-mail, o perfil, a foto nem excluir a conta do cliente.';

const caminhoLimpo = url => String(url).split('?')[0];

function registrarAcao(chamadoId, metodo, caminho, status) {
  db.prepare('INSERT INTO chamado_acoes (chamado_id, metodo, caminho, status, criado_em) VALUES (?, ?, ?, ?, ?)')
    .run(chamadoId, metodo, caminhoLimpo(caminho), status, agora());
}

const ENTIDADES = {
  transactions: 'lançamento', recorrentes: 'recorrente', categorias: 'categoria', contas: 'conta', cartoes: 'cartão',
  transferencias: 'transferência', metas: 'meta', orcamentos: 'orçamento', 'contas-pagar': 'conta a pagar',
};
const VERBOS = { POST: 'Criou', PUT: 'Editou', PATCH: 'Editou', DELETE: 'Excluiu' };

// Frase curta para o cliente entender o que foi feito. `null` = não é uma alteração (por exemplo, a prévia de uma importação).
function rotuloAcao(metodo, caminho) {
  const partes = caminhoLimpo(caminho).replace(/^\/api\//, '').split('/').filter(Boolean);
  const raiz = partes[0];
  const resto = partes.slice(1).filter(p => !/^\d+$/.test(p));
  if (raiz === 'importacao') return resto[0] === 'confirmar' ? 'Importou extrato' : null;
  if (resto[0] === 'pagar') return 'Pagou conta';
  if (resto[0] === 'desfazer') return 'Desfez pagamento';
  if (resto[0] === 'aportes') return metodo === 'DELETE' ? 'Removeu aporte de meta' : 'Registrou aporte ou retirada de meta';
  if (resto[0] === 'lancar' || resto[0] === 'lancar-pendentes') return 'Lançou recorrentes';
  const entidade = ENTIDADES[raiz];
  if (!entidade || !VERBOS[metodo]) return null;
  return `${VERBOS[metodo]} ${entidade}`;
}

function historico(userId) {
  const chamados = db.prepare(`
    SELECT c.id, c.motivo, c.aberto_em, c.ultima_atividade, c.encerrado_em, c.encerrado_por, a.nome AS admin_nome
    FROM chamados_suporte c JOIN users a ON a.id = c.admin_id
    WHERE c.user_id = ? ORDER BY c.aberto_em DESC, c.id DESC LIMIT 50
  `).all(userId);
  const acoes = db.prepare('SELECT metodo, caminho FROM chamado_acoes WHERE chamado_id = ? AND status < 400');
  return chamados.map(c => {
    const contagem = new Map();
    for (const { metodo, caminho } of acoes.all(c.id)) {
      const rotulo = rotuloAcao(metodo, caminho);
      if (rotulo) contagem.set(rotulo, (contagem.get(rotulo) ?? 0) + 1);
    }
    const fim = c.encerrado_em ?? null;
    return {
      id: c.id, admin_nome: c.admin_nome, motivo: c.motivo, aberto_em: c.aberto_em, encerrado_em: fim, encerrado_por: c.encerrado_por,
      duracao_s: fim ? Math.max(0, Math.round((Date.parse(fim) - Date.parse(c.aberto_em)) / 1000)) : null,
      alteracoes: [...contagem].map(([rotulo, n]) => ({ rotulo, n })),
    };
  });
}

// O que a tela precisa para mostrar a barra com o contador.
function descrever(user) {
  const { chamado, admin } = user.suporte;
  return {
    chamado_id: chamado.id, motivo: chamado.motivo, aberto_em: chamado.aberto_em,
    expira_em: expiraEm(chamado), ocioso_ms: ociosoMs(), agora: agora(),
    admin: { nome: admin.nome }, cliente: { nome: user.nome, email: user.email },
  };
}

module.exports = {
  ociosoMs, expiraEm, vencido, chamadoAberto, chamadoAbertoDe, encerrar, encerrarVencidos, renovar, abrir,
  bloqueada, MENSAGEM_BLOQUEIO, registrarAcao, rotuloAcao, historico, descrever,
};
