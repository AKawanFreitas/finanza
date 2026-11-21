// Faz um backup agora.   npm run backup            (usa BACKUP_DIR)
//                        npm run backup -- --dir /caminho
const path = require('path');
const i = process.argv.indexOf('--dir');
if (i >= 0 && process.argv[i + 1]) process.env.BACKUP_DIR = path.resolve(process.argv[i + 1]);
if (!process.env.BACKUP_DIR) process.env.BACKUP_DIR = path.join(__dirname, '..', 'backups');

const { fazerBackup } = require('../lib/backup');
const { arquivo, removidos } = fazerBackup();
console.log(`Backup gravado em ${arquivo}${removidos ? ` (${removidos} antigo(s) removido(s))` : ''}`);
