// Textos dos e-mails. Tudo que vem do usuário (nome, categoria) é escapado no HTML.
const { urlApp } = require('./email');

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const brl = v => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nomeMes = ym => `${MESES[Number(ym.slice(5)) - 1]} de ${ym.slice(0, 4)}`;

function moldura(titulo, corpoHtml, acao) {
  const botao = acao
    ? `<p style="margin:24px 0"><a href="${esc(acao.url)}" style="background:#2f9e44;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:700">${esc(acao.rotulo)}</a></p>
       <p style="color:#55657b;font-size:13px">Se o botão não funcionar, copie este endereço no navegador:<br>${esc(acao.url)}</p>`
    : '';
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;color:#14233a">
    <h1 style="font-size:20px;color:#1b2c47">${esc(titulo)}</h1>${corpoHtml}${botao}
    <hr style="border:none;border-top:1px solid #dbe2e9;margin:28px 0 12px"><p style="color:#8795a8;font-size:12px">Finanza · controle financeiro</p></div>`;
}

const primeiroNome = nome => String(nome).trim().split(/\s+/)[0];

function redefinirSenha({ nome, token, validadeMin }) {
  const url = urlApp(`?redefinir=${encodeURIComponent(token)}`);
  return {
    assunto: 'Redefinir sua senha do Finanza',
    texto: `Olá, ${primeiroNome(nome)}!\n\nRecebemos um pedido para redefinir sua senha. Abra o link abaixo (vale por ${validadeMin} minutos e só pode ser usado uma vez):\n\n${url}\n\nSe não foi você, ignore este e-mail: sua senha continua a mesma.`,
    html: moldura('Redefinir sua senha',
      `<p>Olá, ${esc(primeiroNome(nome))}! Recebemos um pedido para redefinir sua senha. O link vale por ${validadeMin} minutos e só pode ser usado uma vez.</p><p>Se não foi você, ignore este e-mail: sua senha continua a mesma.</p>`,
      { url, rotulo: 'Escolher nova senha' }),
  };
}

function verificarEmail({ nome, token }) {
  const url = urlApp(`?verificar=${encodeURIComponent(token)}`);
  return {
    assunto: 'Confirme seu e-mail no Finanza',
    texto: `Olá, ${primeiroNome(nome)}!\n\nConfirme que este e-mail é seu abrindo o link:\n\n${url}\n\nO link vale por 24 horas.`,
    html: moldura('Confirme seu e-mail', `<p>Olá, ${esc(primeiroNome(nome))}! Confirme que este e-mail é seu. O link vale por 24 horas.</p>`, { url, rotulo: 'Confirmar e-mail' }),
  };
}

function alertaOrcamento({ nome, categoria, limite, gasto, percentual, mes }) {
  const estourou = percentual >= 100;
  const assunto = estourou ? `Orçamento de ${categoria} estourado` : `Orçamento de ${categoria} em ${Math.floor(percentual)}%`;
  const frase = estourou
    ? `Você já gastou ${brl(gasto)} em ${categoria} em ${nomeMes(mes)}, acima do limite de ${brl(limite)}.`
    : `Você já gastou ${brl(gasto)} dos ${brl(limite)} de ${categoria} em ${nomeMes(mes)} (${Math.floor(percentual)}%).`;
  return {
    assunto,
    texto: `Olá, ${primeiroNome(nome)}!\n\n${frase}\n\nAcompanhe em ${urlApp()}`,
    html: moldura(assunto, `<p>Olá, ${esc(primeiroNome(nome))}!</p><p>${esc(frase)}</p>`, { url: urlApp(), rotulo: 'Abrir o Finanza' }),
  };
}

function lembreteVencimentos({ nome, itens }) {
  const dataBR = iso => iso.split('-').reverse().join('/');
  const atrasados = itens.filter(i => i.atrasada).length;
  const assunto = atrasados === itens.length ? `${itens.length === 1 ? 'Conta atrasada' : 'Contas atrasadas'}`
    : itens.length === 1 ? 'Uma conta vence em breve' : `${itens.length} contas vencem em breve`;
  const linha = i => `${i.atrasada ? '⚠ ' : '• '}${i.titulo} — ${brl(i.valor)} (${i.atrasada ? 'venceu em' : 'vence em'} ${dataBR(i.vencimento)})`;
  return {
    assunto,
    texto: `Olá, ${primeiroNome(nome)}!\n\n${itens.map(linha).join('\n')}\n\nMarque como paga em ${urlApp()}\n\nPara não receber estes avisos, desative em Configurações.`,
    html: moldura(assunto, `<p>Olá, ${esc(primeiroNome(nome))}!</p><ul>${itens.map(i => `<li>${i.atrasada ? '⚠ ' : ''}${esc(i.titulo)} — <b>${brl(i.valor)}</b> (${i.atrasada ? 'venceu em' : 'vence em'} ${dataBR(i.vencimento)})</li>`).join('')}</ul>`, { url: urlApp(), rotulo: 'Abrir o Finanza' }),
  };
}

function metaAtingida({ nome, meta, valor }) {
  const assunto = `Meta atingida: ${meta}`;
  const frase = `Parabéns! Você chegou a ${brl(valor)} e atingiu a meta "${meta}".`;
  return {
    assunto,
    texto: `Olá, ${primeiroNome(nome)}!\n\n${frase}\n\nVeja em ${urlApp()}`,
    html: moldura(assunto, `<p>Olá, ${esc(primeiroNome(nome))}!</p><p>${esc(frase)}</p>`, { url: urlApp(), rotulo: 'Abrir o Finanza' }),
  };
}

function resumoMensal({ nome, mes, resumo }) {
  const topo = resumo.porCategoria.slice(0, 3);
  const linhas = topo.map(c => `• ${c.cat}: ${brl(c.valor)}`).join('\n');
  const saldoTxt = `${resumo.saldo < 0 ? '−' : ''}${brl(Math.abs(resumo.saldo))}`;
  return {
    assunto: `Seu resumo de ${nomeMes(mes)}`,
    texto: `Olá, ${primeiroNome(nome)}!\n\nResumo de ${nomeMes(mes)}:\n• Receitas: ${brl(resumo.entradas)}\n• Gastos: ${brl(resumo.saidas)}\n• Saldo do mês: ${saldoTxt}\n${topo.length ? `\nOnde mais gastou:\n${linhas}\n` : ''}\nVeja os detalhes em ${urlApp()}\n\nPara não receber estes avisos, desative em Configurações.`,
    html: moldura(`Seu resumo de ${nomeMes(mes)}`,
      `<p>Olá, ${esc(primeiroNome(nome))}!</p>
       <table style="width:100%;border-collapse:collapse">
         <tr><td>Receitas</td><td style="text-align:right"><b>${brl(resumo.entradas)}</b></td></tr>
         <tr><td>Gastos</td><td style="text-align:right"><b>${brl(resumo.saidas)}</b></td></tr>
         <tr><td>Saldo do mês</td><td style="text-align:right"><b>${esc(saldoTxt)}</b></td></tr></table>
       ${topo.length ? `<p style="margin-top:18px"><b>Onde mais gastou</b></p><ul>${topo.map(c => `<li>${esc(c.cat)}: ${brl(c.valor)}</li>`).join('')}</ul>` : ''}
       <p style="color:#55657b;font-size:13px">Para não receber estes avisos, desative em Configurações.</p>`,
      { url: urlApp(), rotulo: 'Abrir o Finanza' }),
  };
}

module.exports = { redefinirSenha, verificarEmail, alertaOrcamento, metaAtingida, lembreteVencimentos, resumoMensal };
