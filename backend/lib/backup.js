// Backup do banco com VACUUM INTO: gera uma cópia consistente mesmo com a API em uso.
// Cada cópia é aberta e verificada (PRAGMA integrity_check) antes de contar como válida,
// e só as últimas `manter` ficam no disco.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const db = require('../db');
const { hojeBR } = require('./datas');

const PREFIXO = 'finanza-';
const EXT = '.db';
const reArquivo = /^finanza-(\d{4}-\d{2}-\d{2})-\d{6}\.db$/;

const pastaDeBackup = () => process.env.BACKUP_DIR || null;
const quantosManter = () => Math.max(1, Number.parseInt(process.env.BACKUP_KEEP, 10) || 7);

const listar = dir => (fs.existsSync(dir) ? fs.readdirSync(dir).filter(n => reArquivo.test(n)).sort() : []);

function integro(arquivo) {
  const copia = new Database(arquivo, { readonly: true });
  try { return copia.pragma('integrity_check', { simple: true }) === 'ok'; }
  finally { copia.close(); }
}

// Cria um backup em `dir` e apaga os mais antigos. Devolve { arquivo, removidos }.
function fazerBackup({ dir = pastaDeBackup(), manter = quantosManter(), agora = new Date() } = {}) {
  if (!dir) throw new Error('Defina BACKUP_DIR para fazer backups.');
  fs.mkdirSync(dir, { recursive: true });

  const carimbo = agora.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15); // 20260321-031500
  const nome = `${PREFIXO}${carimbo.slice(0, 4)}-${carimbo.slice(4, 6)}-${carimbo.slice(6, 8)}-${carimbo.slice(9, 15)}${EXT}`;
  const destino = path.join(dir, nome);
  if (fs.existsSync(destino)) fs.rmSync(destino);

  db.exec(`VACUUM INTO '${destino.replace(/'/g, "''")}'`);
  if (!integro(destino)) {
    fs.rmSync(destino, { force: true });
    throw new Error('O backup gerado falhou na verificação de integridade e foi descartado.');
  }

  const todos = listar(dir);
  const removidos = todos.slice(0, Math.max(0, todos.length - manter));
  for (const n of removidos) fs.rmSync(path.join(dir, n), { force: true });
  return { arquivo: destino, removidos: removidos.length };
}

// Para o agendador: faz um backup por dia (no fuso do Brasil), a menos que já exista o de hoje.
function backupDoDia(agora = new Date()) {
  const dir = pastaDeBackup();
  if (!dir) return null;
  const hoje = hojeBR(agora);
  if (listar(dir).some(n => n.startsWith(`${PREFIXO}${hoje}-`))) return null;
  return fazerBackup({ dir, agora: new Date(agora.getTime() - 3 * 3600e3) });
}

module.exports = { fazerBackup, backupDoDia, listar };
