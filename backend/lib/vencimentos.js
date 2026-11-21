const db = require('../db');
const { hojeBR, diasEntre } = require('./datas');
const { listar } = require('./contasPagar');
const { buscarCartao, listarFaturas } = require('./cartoes');

// Tudo o que o usuário ainda precisa pagar: contas a pagar em aberto e faturas de cartão fechadas
// (ou pagas em parte) com valor restante. Do mais antigo ao mais novo, para o atraso aparecer primeiro.
function vencimentosEmAberto(userId, hoje = hojeBR()) {
  const contas = listar(userId, { status: 'abertas', hoje }).map(c => ({
    tipo: 'conta', id: c.id, titulo: c.descricao, valor: c.valor, vencimento: c.vencimento,
    dias: c.dias, atrasada: c.status === 'atrasada', chave: `conta:${c.id}`,
  }));

  const faturas = [];
  const cartoes = db.prepare("SELECT id FROM contas WHERE user_id = ? AND tipo = 'cartao' AND arquivada = 0").all(userId);
  for (const { id } of cartoes) {
    const cartao = buscarCartao(userId, id);
    for (const f of listarFaturas(cartao, hoje)) {
      if (f.restante <= 0 || f.status === 'aberta') continue;
      faturas.push({
        tipo: 'fatura', id: cartao.id, titulo: `Fatura ${cartao.nome} (${f.mes.slice(5)}/${f.mes.slice(0, 4)})`, valor: f.restante,
        vencimento: f.vencimento, dias: diasEntre(hoje, f.vencimento), atrasada: f.status === 'vencida', chave: `fatura:${cartao.id}:${f.mes}`,
      });
    }
  }
  return [...contas, ...faturas].sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.titulo.localeCompare(b.titulo));
}

const proximosVencimentos = (userId, limite = 6, hoje = hojeBR()) => vencimentosEmAberto(userId, hoje).slice(0, limite);

module.exports = { vencimentosEmAberto, proximosVencimentos };
