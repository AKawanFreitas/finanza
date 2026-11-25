// Exclusões de categoria, conta e cartão que só estão ligados a uma conta a pagar ou a um recorrente
// não podem virar erro 500 (FOREIGN KEY): ou recusam com mensagem, ou desfazem o vínculo.
const test = require('node:test');
const assert = require('node:assert/strict');
const { db, novoUsuario } = require('./helpers');

test('categoria usada só por uma conta a pagar: recusa com mensagem, sem erro 500', async () => {
  const u = await novoUsuario();
  const cat = (await u.agente.post('/api/categorias').send({ nome: 'Boletos', cor: '#123456' })).body;
  await u.agente.post('/api/contas-pagar').send({ descricao: 'Luz', valor: 120, vencimento: '2026-12-05', categoria_id: cat.id });

  const r = await u.agente.delete(`/api/categorias/${cat.id}`);
  assert.equal(r.status, 409);
  assert.match(r.body.error, /Boletos/);
});

test('conta planejada de um recorrente pode ser excluída: o recorrente volta para a conta principal', async () => {
  const u = await novoUsuario();
  const conta = (await u.agente.post('/api/contas').send({ nome: 'Inter', tipo: 'corrente' })).body;
  const rec = (await u.agente.post('/api/recorrentes').send({ nome: 'Netflix', valor: 55.9, tipo: 'fixo', dia: 10, cat: 'Outros', conta_id: conta.id, automatico: true })).body;

  assert.equal((await u.agente.delete(`/api/contas/${conta.id}`)).status, 200);
  assert.equal(db.prepare('SELECT conta_id FROM recorrentes WHERE id = ?').get(rec.id).conta_id, null);
});

test('conta planejada de uma conta a pagar pode ser excluída: a conta a pagar fica sem conta planejada', async () => {
  const u = await novoUsuario();
  const conta = (await u.agente.post('/api/contas').send({ nome: 'C6', tipo: 'corrente' })).body;
  const cp = (await u.agente.post('/api/contas-pagar').send({ descricao: 'Água', valor: 80, vencimento: '2026-12-05', cat: 'Outros', conta_id: conta.id })).body;

  assert.equal((await u.agente.delete(`/api/contas/${conta.id}`)).status, 200);
  assert.equal(db.prepare('SELECT conta_id FROM contas_pagar WHERE id = ?').get(cp.id).conta_id, null);
});

test('cartão sem compras, mas planejado num recorrente e numa conta a pagar, pode ser excluído', async () => {
  const u = await novoUsuario();
  const cartao = (await u.agente.post('/api/cartoes').send({ nome: 'Visa', limite: 500, dia_fechamento: 5, dia_vencimento: 15 })).body;
  await u.agente.post('/api/recorrentes').send({ nome: 'Spotify', valor: 21.9, tipo: 'fixo', dia: 3, cat: 'Outros', conta_id: cartao.id });
  await u.agente.post('/api/contas-pagar').send({ descricao: 'Anuidade', valor: 30, vencimento: '2026-12-10', cat: 'Outros', conta_id: cartao.id });

  assert.equal((await u.agente.delete(`/api/cartoes/${cartao.id}`)).status, 200);
});
