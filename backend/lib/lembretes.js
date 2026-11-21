const db = require('../db');
const { hojeBR } = require('./datas');
const { notificarLote } = require('./notificar');
const { lembreteVencimentos } = require('./templates');
const { vencimentosEmAberto } = require('./vencimentos');

const ANTECEDENCIA_DIAS = 3;   // avisa quando faltam até 3 dias
const ATRASO_MAXIMO_DIAS = 30; // e cobra atrasos de até 30 dias (depois disso o aviso já virou ruído)
const HORA_INICIAL = 7;        // sem e-mail de madrugada (hora do Brasil)

// Um e-mail por pessoa com tudo que venceu ou vence em breve, uma vez por item (e uma vez de novo se atrasar).
// A chave inclui a fase: "lembrete" e "atrasada" são avisos distintos do mesmo item.
function enviarLembretes(agora = new Date()) {
  const horaBR = new Date(agora.getTime() - 3 * 3600e3).getUTCHours();
  if (horaBR < HORA_INICIAL) return 0;
  const hoje = hojeBR(agora);

  const usuarios = db.prepare(`
    SELECT id FROM users WHERE status = 'ativo' AND email_verificado_em IS NOT NULL AND notificacoes_email = 1
  `).all();

  let enviados = 0;
  for (const { id } of usuarios) {
    const itens = vencimentosEmAberto(id, hoje)
      .filter(i => (i.atrasada ? i.dias >= -ATRASO_MAXIMO_DIAS : i.dias <= ANTECEDENCIA_DIAS));
    enviados += notificarLote(id, 'vencimento', itens, i => `${i.chave}:${i.atrasada ? 'atrasada' : 'lembrete'}`,
      (user, novos) => lembreteVencimentos({ nome: user.nome, itens: novos }));
  }
  return enviados;
}

module.exports = { enviarLembretes };
