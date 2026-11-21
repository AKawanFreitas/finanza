const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { lerEnv, carregarEnv } = require('../lib/env');

const temp = conteudo => {
  const arquivo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'finanza-env-')), '.env');
  fs.writeFileSync(arquivo, conteudo);
  return arquivo;
};

test('lê CHAVE=valor, ignora comentários e linhas vazias', () => {
  const v = lerEnv('# comentário\n\nPORT=4747\n  LOG_LEVEL = debug \nexport APP_URL=http://x.com\n');
  assert.deepEqual(v, { PORT: '4747', LOG_LEVEL: 'debug', APP_URL: 'http://x.com' });
});

test('aspas preservam espaços, # e = dentro do valor', () => {
  const v = lerEnv(`A="com espaço # e = sinal"\nB='simples'\nC=sem aspas # comentário no fim\nD=`);
  assert.deepEqual(v, { A: 'com espaço # e = sinal', B: 'simples', C: 'sem aspas', D: '' });
});

test('senha com caracteres especiais sem aspas é lida inteira', () => {
  assert.equal(lerEnv('SENHA=S3nh@-com-sinais!').SENHA, 'S3nh@-com-sinais!');
});

test('linhas inválidas são ignoradas, sem quebrar', () => {
  assert.deepEqual(lerEnv('isso não é uma variável\n=sem_nome\n1COMNUMERO=x\nOK=1'), { OK: '1' });
});

test('aceita CRLF (arquivo criado no Windows)', () => {
  assert.deepEqual(lerEnv('A=1\r\nB=2\r\n'), { A: '1', B: '2' });
});

test('o ambiente real nunca é sobrescrito; o primeiro arquivo vence o segundo', () => {
  const alvo = { JA_EXISTE: 'do-ambiente' };
  const um = temp('JA_EXISTE=do-arquivo\nSO_NO_UM=um\nNOS_DOIS=do-um');
  const dois = temp('SO_NO_DOIS=dois\nNOS_DOIS=do-dois');
  const lidos = carregarEnv([um, dois, '/nao/existe/.env'], alvo);
  assert.equal(lidos.length, 2);
  assert.deepEqual(alvo, { JA_EXISTE: 'do-ambiente', SO_NO_UM: 'um', NOS_DOIS: 'do-um', SO_NO_DOIS: 'dois' });
});

test('sem nenhum arquivo, não faz nada', () => {
  const alvo = {};
  assert.deepEqual(carregarEnv(['/nao/existe/.env'], alvo), []);
  assert.deepEqual(alvo, {});
});
