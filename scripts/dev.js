/* global process */
// Sobe a API (backend/) e o front (Vite) juntos, num terminal só: `npm run dev`.
// Cada linha sai com o prefixo de quem a escreveu. Ctrl+C encerra os dois; se um cair, o outro também para.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const cor = process.stdout.isTTY && !process.env.NO_COLOR

const tarefas = [
  { nome: 'api', cwd: join(raiz, 'backend'), args: ['run', 'dev'], tom: 35 },
  { nome: 'web', cwd: raiz, args: ['run', 'dev:web'], tom: 36 },
]

const faltando = tarefas.filter((t) => !existsSync(join(t.cwd, 'node_modules')))
if (faltando.length) {
  for (const t of faltando) console.error(`Faltam as dependências em ${t.cwd}. Rode: npm install --prefix ${t.cwd}`)
  process.exit(1)
}

const filhos = []
let encerrando = false

function prefixo(t) {
  const rotulo = `[${t.nome}]`
  return cor ? `\x1b[${t.tom}m${rotulo}\x1b[0m ` : `${rotulo} `
}

function repassar(stream, destino, t) {
  let resto = ''
  stream.on('data', (pedaco) => {
    const linhas = (resto + pedaco).split('\n')
    resto = linhas.pop()
    for (const linha of linhas) destino.write(prefixo(t) + linha + '\n')
  })
  stream.on('end', () => {
    if (resto) destino.write(prefixo(t) + resto + '\n')
  })
}

// O npm abre um shell que abre o node/vite; matar só o npm deixaria os netos rodando com a porta presa.
// Por isso cada filho tem o próprio grupo de processos e o sinal vai para o grupo todo.
function matar(filho) {
  if (filho.exitCode !== null) return
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(filho.pid), '/T', '/F'], { stdio: 'ignore' })
    return
  }
  try {
    process.kill(-filho.pid, 'SIGTERM')
  } catch {
    filho.kill('SIGTERM')
  }
}

function encerrar(codigo) {
  if (encerrando) return
  encerrando = true
  for (const filho of filhos) matar(filho)
  // Se algum processo não sair sozinho, força a saída depois de alguns segundos.
  setTimeout(() => process.exit(codigo), 4000).unref()
  Promise.all(filhos.map((f) => (f.exitCode === null ? new Promise((r) => f.once('exit', r)) : null))).then(() =>
    process.exit(codigo)
  )
}

for (const t of tarefas) {
  const filho = spawn(npm, t.args, {
    cwd: t.cwd,
    env: { ...process.env, FORCE_COLOR: cor ? '1' : '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    detached: process.platform !== 'win32',
  })
  repassar(filho.stdout, process.stdout, t)
  repassar(filho.stderr, process.stderr, t)
  filho.on('exit', (codigo, sinal) => {
    if (encerrando) return
    console.error(`${prefixo(t)}parou (${sinal ?? `código ${codigo}`}); encerrando o outro processo.`)
    encerrar(codigo || 1)
  })
  filhos.push(filho)
}

process.on('SIGINT', () => encerrar(0))
process.on('SIGTERM', () => encerrar(0))
process.on('SIGHUP', () => encerrar(0))
