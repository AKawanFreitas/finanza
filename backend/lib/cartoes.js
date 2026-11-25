const db = require('../db');
const { paraReais } = require('./money');
const { deslocarMes, dataVencimento, hojeBR } = require('./datas');
const { listarContas } = require('./contas');

// Fatura (AAAA-MM) de um lançamento num cartão: compras até o dia do fechamento entram na fatura
// do próprio mês; depois dele, na do mês seguinte. A fatura leva o nome do mês em que FECHA.
// Calculada na consulta (nada gravado): mudar o dia de fechamento reorganiza as faturas junto.
const FATURA_SQL = `CASE WHEN CAST(substr(t.data, 9, 2) AS INTEGER) <= k.dia_fechamento
  THEN substr(t.data, 1, 7) ELSE strftime('%Y-%m', t.data, 'start of month', '+1 month') END`;

const mesDaFatura = (dataISO, diaFechamento) =>
  Number(dataISO.slice(8)) <= diaFechamento ? dataISO.slice(0, 7) : deslocarMes(dataISO.slice(0, 7), 1);

// Datas da fatura do mês `mes`. Se o vencimento é depois do fechamento no calendário (fecha dia 5, vence dia 15),
// vence no mesmo mês; senão (fecha dia 25, vence dia 5), no mês seguinte.
function datasDaFatura(mes, cfg) {
  const mesVenc = cfg.dia_vencimento > cfg.dia_fechamento ? mes : deslocarMes(mes, 1);
  return { fechamento: dataVencimento(mes, cfg.dia_fechamento), vencimento: dataVencimento(mesVenc, cfg.dia_vencimento) };
}

// aberta: ainda recebendo compras · fechada: aguardando pagamento · vencida: passou do vencimento sem quitar
// parcial: paga em parte · paga: quitada
function statusDaFatura(total, pago, datas, hoje) {
  if (total > 0 && pago >= total) return 'paga';
  if (pago > 0) return 'parcial';
  if (hoje <= datas.fechamento) return 'aberta';
  return total > 0 && hoje > datas.vencimento ? 'vencida' : 'fechada';
}

// O cartão do usuário (conta + configuração), ou null.
function buscarCartao(userId, contaId) {
  return db.prepare(`
    SELECT c.id, c.nome, c.cor, c.arquivada, k.limite_centavos, k.dia_fechamento, k.dia_vencimento, k.conta_pagamento_id
    FROM contas c JOIN cartoes k ON k.conta_id = c.id
    WHERE c.id = ? AND c.user_id = ? AND c.tipo = 'cartao'
  `).get(contaId, userId) || null;
}

function montarFatura(mes, cfg, total, pago, itens, hoje) {
  const datas = datasDaFatura(mes, cfg);
  return {
    mes, ...datas, itens,
    total: paraReais(total), pago: paraReais(pago), restante: paraReais(Math.max(0, total - pago)),
    status: statusDaFatura(total, pago, datas, hoje),
  };
}

const totaisPorFatura = contaId => db.prepare(`
  SELECT ${FATURA_SQL} AS mes, COUNT(*) AS itens,
         SUM(CASE t.tipo WHEN 'saida' THEN t.valor_centavos ELSE -t.valor_centavos END) AS total
  FROM transactions t JOIN cartoes k ON k.conta_id = t.conta_id
  WHERE t.conta_id = ? GROUP BY mes
`).all(contaId);

const pagoPorFatura = contaId => new Map(db.prepare(`
  SELECT fatura_ref AS mes, SUM(valor_centavos) AS pago FROM transferencias
  WHERE destino_id = ? AND fatura_ref IS NOT NULL GROUP BY fatura_ref
`).all(contaId).map(r => [r.mes, r.pago]));

// Todas as faturas do cartão (meses com compras ou pagamentos), da mais recente para a mais antiga.
function listarFaturas(cartao, hoje = hojeBR()) {
  const totais = new Map(totaisPorFatura(cartao.id).map(r => [r.mes, r]));
  const pagos = pagoPorFatura(cartao.id);
  const meses = [...new Set([...totais.keys(), ...pagos.keys()])].sort().reverse();
  return meses.map(m => montarFatura(m, cartao, totais.get(m)?.total ?? 0, pagos.get(m) ?? 0, totais.get(m)?.itens ?? 0, hoje));
}

function buscarFatura(cartao, mes, hoje = hojeBR()) {
  const t = totaisPorFatura(cartao.id).find(r => r.mes === mes);
  const pago = pagoPorFatura(cartao.id).get(mes) ?? 0;
  return montarFatura(mes, cartao, t?.total ?? 0, pago, t?.itens ?? 0, hoje);
}

// Cartão com limite, uso e fatura em curso, para a listagem. A dívida é o saldo negativo da conta.
function resumoDoCartao(userId, cartao, hoje = hojeBR()) {
  const saldo = listarContas(userId, { id: cartao.id })[0].saldo_centavos;
  const usado = Math.max(0, -saldo);
  const atual = buscarFatura(cartao, mesDaFatura(hoje, cartao.dia_fechamento), hoje);
  return {
    id: cartao.id, nome: cartao.nome, cor: cartao.cor, arquivada: !!cartao.arquivada,
    dia_fechamento: cartao.dia_fechamento, dia_vencimento: cartao.dia_vencimento,
    conta_pagamento_id: cartao.conta_pagamento_id,
    limite: paraReais(cartao.limite_centavos), usado: paraReais(usado),
    disponivel: paraReais(cartao.limite_centavos - usado),
    percentual_usado: Math.min(100, Math.round((usado / cartao.limite_centavos) * 1000) / 10),
    limite_estourado: usado > cartao.limite_centavos,
    fatura_atual: atual,
  };
}

// A compra acima do limite é salva (o banco pode ter aprovado de verdade), mas a resposta avisa.
// Devolve o texto do aviso, ou undefined se a conta não é cartão ou ainda há limite.
function avisoDeLimite(userId, contaId) {
  const cartao = buscarCartao(userId, contaId);
  if (!cartao) return undefined;
  const r = resumoDoCartao(userId, cartao);
  if (!r.limite_estourado) return undefined;
  const excesso = (-r.disponivel).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return `Lançamento salvo, mas o limite do cartão ${cartao.nome} foi ultrapassado em ${excesso}.`;
}

module.exports = { avisoDeLimite, FATURA_SQL, mesDaFatura, datasDaFatura, statusDaFatura, buscarCartao, listarFaturas, buscarFatura, resumoDoCartao };
