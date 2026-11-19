# Finanza

Controle financeiro pessoal: lançamentos de entradas e saídas, gastos recorrentes, categorias e um dashboard mensal.

- **Front:** React 18 + Vite
- **Back:** Express + SQLite (`better-sqlite3`)

## Como rodar

Precisa do Node.js (testado na versão 24). São dois processos: a API e o front.

```bash
# 1. API (porta 3001)
cd backend
npm install
npm run dev

# 2. Front (porta 5173), em outro terminal, na raiz do projeto
npm install
npm run dev
```

Abra http://localhost:5173. O Vite encaminha as chamadas `/api` para o backend.

### Variáveis de ambiente

| Variável   | Onde    | Padrão                  | Para que serve                          |
| ---------- | ------- | ----------------------- | --------------------------------------- |
| `PORT`     | backend | `3001`                  | Porta da API                            |
| `DB_PATH`  | backend | `backend/financeiro.db` | Arquivo do banco SQLite                 |
| `API_PORT` | front   | `3001`                  | Porta da API para onde o Vite encaminha |

Se a porta 3001 já estiver ocupada na sua máquina:

```bash
cd backend && PORT=3101 npm run dev
API_PORT=3101 npm run dev   # na raiz
```

Para experimentar sem mexer nos seus dados, aponte `DB_PATH` para um arquivo temporário. O banco é criado sozinho, já com as categorias padrão.

## Scripts

Na raiz:

| Comando           | O que faz                        |
| ----------------- | -------------------------------- |
| `npm run dev`     | Front em modo desenvolvimento    |
| `npm run build`   | Build de produção em `dist/`     |
| `npm run preview` | Serve o build localmente         |
| `npm run lint`    | ESLint (o `backend/` é ignorado) |

No `backend/`: `npm start` e `npm run dev` (reinicia ao salvar).

## O que o app faz

- **Resumo:** indicadores do mês (saldo, receitas, gastos e contas fixas, com variação em relação ao mês anterior), gastos por dia, divisão por categoria, últimas movimentações, comprometimento da renda e histórico dos últimos 6 meses. O mês é trocado pelas setas no topo da página.
- **Lançamentos:** criar, editar e excluir entradas e saídas. A lista filtra por texto, tipo, categoria e mês e mostra o saldo do que está filtrado.
- **Recorrentes:** cadastro de despesas mensais (fixas ou variáveis). Cada uma pode ser lançada como gasto do mês atual, uma a uma ou todas as pendentes, sem duplicar.
- **Categorias:** criar, editar (nome e cor) e excluir. Renomear atualiza também os lançamentos e recorrentes da categoria. Categoria em uso não pode ser excluída.

## API

Base: `/api`. Erros de validação voltam como `{ "error": "mensagem" }` com status 400, 404 ou 409.

| Recurso             | Rotas                                    |
| ------------------- | ---------------------------------------- |
| `/api/transactions` | `GET`, `POST`, `PUT /:id`, `DELETE /:id` |
| `/api/recorrentes`  | `GET`, `POST`, `PUT /:id`, `DELETE /:id` |
| `/api/categorias`   | `GET`, `POST`, `PUT /:id`, `DELETE /:id` |

Formatos:

- **transactions:** `{ desc, valor, tipo: "entrada" | "saida", cat, data: "AAAA-MM-DD", obs? }`
- **recorrentes:** `{ nome, valor, tipo: "fixo" | "recorrente", cat, dia: 1–31, obs? }`
- **categorias:** `{ nome, cor: "#RRGGBB" }`

Lançamentos e recorrentes guardam a categoria pelo nome, não por id.

## Estrutura

```
backend/
  server.js, db.js       Servidor Express e criação das tabelas
  routes/                transactions, recorrentes, categorias
src/
  context/               Estado global e chamadas à API
  sections/              Dashboard, Lancamentos, Recorrentes, Categorias
  components/            Sidebar, MonthStepper, Select, Toast
  utils/                 Formatadores e funções de período
  index.css              Estilos
```

O banco `backend/financeiro.db` é criado na primeira execução e não é versionado (guarda contas e dados financeiros).
