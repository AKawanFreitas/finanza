// Envio de e-mail. Com SMTP_URL configurado, usa SMTP (nodemailer). Sem ele (desenvolvimento e testes),
// escreve o e-mail no console, o que basta para copiar links de verificação e redefinição de senha.
// `enviados` guarda os e-mails em memória, só em testes, para eles conferirem o conteúdo.
const nodemailer = require('nodemailer');

const enviados = [];

let transporte;
function obterTransporte() {
  if (transporte === undefined) transporte = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;
  return transporte;
}

const remetente = () => process.env.EMAIL_FROM || 'Finanza <nao-responda@finanza.local>';

async function enviarEmail({ para, assunto, texto, html }) {
  if (process.env.NODE_ENV === 'test') enviados.push({ para, assunto, texto, html, em: new Date().toISOString() });

  const t = obterTransporte();
  if (t) {
    await t.sendMail({ from: remetente(), to: para, subject: assunto, text: texto, html });
  } else if (process.env.NODE_ENV !== 'test') {
    console.log(`\n[e-mail] para: ${para}\n[e-mail] assunto: ${assunto}\n${texto}\n`);
  }
}

// Link absoluto para o app (o front lê os parâmetros e abre a tela certa).
const urlApp = (caminho = '') => `${(process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '')}/${caminho}`;

module.exports = { enviarEmail, urlApp, enviados };
