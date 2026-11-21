const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const { novoUsuario } = require('./helpers');
const { fazerBackup, backupDoDia, listar } = require('../lib/backup');

const pastaTemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'finanza-bkp-'));
const em = iso => new Date(`${iso}Z`);

test('o backup é um banco SQLite válido com os dados atuais', async () => {
  const u = await novoUsuario('Ana Backup');
  await u.agente.post('/api/transactions').send({ desc: 'Compra', valor: 12.34, tipo: 'saida', cat: 'Outros', data: '2026-03-01' });
  const dir = pastaTemp();
  const { arquivo } = fazerBackup({ dir });
  const copia = new Database(arquivo, { readonly: true });
  assert.equal(copia.pragma('integrity_check', { simple: true }), 'ok');
  assert.equal(copia.prepare('SELECT valor_centavos FROM transactions WHERE descricao = ?').get('Compra').valor_centavos, 1234);
  assert.ok(copia.prepare('SELECT 1 FROM users WHERE nome = ?').get('Ana Backup'));
  copia.close();
});

test('guarda só os N mais recentes', () => {
  const dir = pastaTemp();
  for (const d of ['2026-03-01T10:00:00', '2026-03-02T10:00:00', '2026-03-03T10:00:00', '2026-03-04T10:00:00']) {
    fazerBackup({ dir, manter: 3, agora: em(d) });
  }
  const nomes = listar(dir);
  assert.equal(nomes.length, 3);
  assert.ok(nomes[0].includes('2026-03-02'), 'o mais antigo foi removido');
});

test('não apaga arquivos que não são backups', () => {
  const dir = pastaTemp();
  fs.writeFileSync(path.join(dir, 'notas.txt'), 'meu arquivo');
  fazerBackup({ dir, manter: 1, agora: em('2026-03-01T10:00:00') });
  fazerBackup({ dir, manter: 1, agora: em('2026-03-02T10:00:00') });
  assert.ok(fs.existsSync(path.join(dir, 'notas.txt')));
});

test('o backup do dia roda uma vez só por dia (fuso do Brasil)', () => {
  const dir = pastaTemp();
  process.env.BACKUP_DIR = dir;
  try {
    assert.ok(backupDoDia(em('2026-03-10T12:00:00')), 'primeiro do dia');
    assert.equal(backupDoDia(em('2026-03-10T15:00:00')), null, 'já existe o de hoje');
    assert.ok(backupDoDia(em('2026-03-11T12:00:00')), 'dia seguinte');
    // 01h UTC do dia 12 ainda é dia 11 em Brasília: o backup de 11 já existe.
    assert.equal(backupDoDia(em('2026-03-12T01:00:00')), null);
    assert.equal(listar(dir).length, 2);
  } finally {
    delete process.env.BACKUP_DIR;
  }
});

test('sem BACKUP_DIR o agendador não faz backup, e a função direta exige a pasta', () => {
  delete process.env.BACKUP_DIR;
  assert.equal(backupDoDia(), null);
  assert.throws(() => fazerBackup(), /BACKUP_DIR/);
});

test('nome de pasta com aspas não quebra o comando', () => {
  const dir = path.join(pastaTemp(), "d'ados");
  const { arquivo } = fazerBackup({ dir });
  assert.ok(fs.existsSync(arquivo));
});
