// Leitor mínimo de arquivos .env (sem dependência). Procura backend/.env e, depois, ../.env (a raiz do projeto,
// que é o que o docker compose lê). Variáveis já definidas no ambiente NUNCA são sobrescritas, e o primeiro arquivo
// que define uma variável vence o seguinte.
const fs = require('fs');
const path = require('path');

const ARQUIVOS = [path.join(__dirname, '..', '.env'), path.join(__dirname, '..', '..', '.env')];

// "CHAVE=valor", com aspas simples ou duplas opcionais, comentários com # e "export " no início.
function lerEnv(texto) {
  const vars = {};
  for (const bruta of String(texto).split(/\r?\n/)) {
    const linha = bruta.trim();
    if (!linha || linha.startsWith('#')) continue;
    const m = linha.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let valor = m[2].trim();
    const aspas = valor[0];
    if ((aspas === '"' || aspas === "'") && valor.length >= 2 && valor.endsWith(aspas)) valor = valor.slice(1, -1);
    else valor = valor.replace(/\s+#.*$/, ''); // comentário no fim da linha (só fora de aspas)
    vars[m[1]] = valor;
  }
  return vars;
}

// Aplica os arquivos encontrados a `alvo` (process.env por padrão). Devolve os que foram lidos.
function carregarEnv(arquivos = ARQUIVOS, alvo = process.env) {
  const lidos = [];
  for (const arquivo of arquivos) {
    if (!fs.existsSync(arquivo)) continue;
    for (const [k, v] of Object.entries(lerEnv(fs.readFileSync(arquivo, 'utf8')))) {
      if (alvo[k] === undefined) alvo[k] = v;
    }
    lidos.push(arquivo);
  }
  return lidos;
}

module.exports = { lerEnv, carregarEnv };
