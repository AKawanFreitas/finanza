const db = require('../db');
const { hojeBR, deslocarMes } = require('./datas');
const { calcularResumo } = require('./resumo');
const { notificarUmaVez } = require('./notificar');
const { resumoMensal } = require('./templates');

// Nos primeiros dias do mês, manda o resumo do mês anterior a quem confirmou o e-mail e não optou por sair.
// Uma vez por mês por pessoa (registro em `notificacoes`); quem não teve movimentação não recebe.
// A janela de 5 dias evita mandar um resumo "velho" quando o app é implantado no meio do mês.
function enviarResumosMensais(agora = new Date()) {
  const hoje = hojeBR(agora);
  if (Number(hoje.slice(8)) > 5) return 0;
  const mes = deslocarMes(hoje.slice(0, 7), -1);

  const usuarios = db.prepare(
    "SELECT id FROM users WHERE status = 'ativo' AND email_verificado_em IS NOT NULL AND notificacoes_email = 1"
  ).all();

  let enviados = 0;
  for (const { id } of usuarios) {
    const resumo = calcularResumo(id, mes);
    if (resumo.qtd.total === 0) continue;
    if (notificarUmaVez(id, 'resumo_mensal', mes, user => resumoMensal({ nome: user.nome, mes, resumo }))) enviados++;
  }
  return enviados;
}

module.exports = { enviarResumosMensais };
