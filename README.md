# Finanza

Controle financeiro pessoal em formato SaaS: cada pessoa tem a sua conta, com lançamentos, gastos recorrentes, categorias e um resumo mensal. Um super admin administra as contas.

- **Front:** React 18 + Vite
- **Back:** Express + SQLite (`better-sqlite3`)

## Como rodar

Precisa do Node.js (testado na versão 24). São dois processos: a API e o front.

```bash
# 1. API (porta 4747)
cd backend
npm install
npm run dev

# 2. Front (porta 5173), em outro terminal, na raiz do projeto
npm install
npm run dev
```

Abra http://localhost:5173. O Vite encaminha as chamadas `/api` para o backend.

### Primeiro acesso

Qualquer pessoa pode criar a própria conta pela tela de entrada. O super admin, porém, só é criado pelo terminal:

```bash
cd backend
npm run create-admin -- --email voce@exemplo.com --nome "Seu Nome"
```

Sem `--senha`, o comando mostra uma senha provisória e pede a troca no primeiro acesso. Se o banco já tinha lançamentos de antes das contas, eles passam para esse administrador.

### Variáveis de ambiente

| Variável   | Onde    | Padrão                  | Para que serve                          |
| ---------- | ------- | ----------------------- | --------------------------------------- |
| `PORT`     | backend | `4747`                  | Porta da API                            |
| `DB_PATH`  | backend | `backend/financeiro.db` | Arquivo do banco SQLite                 |
| `API_PORT` | front   | `4747`                  | Porta da API para onde o Vite encaminha |
| `NODE_ENV` | backend | —                       | Com `production`, o cookie de sessão exige HTTPS |
| `CORS_ORIGIN` | backend | —                    | Origens liberadas quando o front não passa pelo proxy |

Se a porta 4747 já estiver ocupada na sua máquina:

```bash
cd backend && PORT=4800 npm run dev
API_PORT=4800 npm run dev   # na raiz
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

No `backend/`: `npm start`, `npm run dev` (reinicia ao salvar), `npm test` (testes da API), `npm run create-admin` e `npm run seed` (carga de demonstração em `backend/demo.db`; use `-- --email alguem@exemplo.com` para escolher a conta).

## O que o app faz

- **Resumo:** (calculado no servidor) indicadores do mês (saldo, receitas, gastos e contas fixas, com variação em relação ao mês anterior), gastos por dia, divisão por categoria, últimas movimentações, comprometimento da renda e histórico dos últimos 6 meses. O mês é trocado pelas setas no topo da página.
- **Lançamentos:** criar, editar e excluir entradas e saídas, cada uma numa conta. A lista é paginada no servidor e filtra por texto (sem diferenciar acento nem maiúsculas), tipo, categoria, conta e mês, mostrando o saldo de tudo o que está filtrado.
- **Contas:** carteiras, bancos, poupança e investimentos, com saldo calculado (inicial + lançamentos + transferências). Transferências entre contas não contam como receita nem gasto. Conta com movimentações é arquivada, não excluída.
- **Importar extrato:** OFX (conta e cartão) e CSV (separador, aspas e formatos de data e valor brasileiros detectados sozinhos). Mostra uma prévia com categoria sugerida (a que você já usou para a mesma descrição), marca o que já foi importado ou parece duplicado e só grava o que você confirmar. Importar o mesmo arquivo duas vezes não duplica.
- **Recorrentes:** cadastro de despesas mensais (fixas ou variáveis). Cada uma pode ser lançada como gasto do mês atual, uma a uma ou todas as pendentes. O servidor liga o lançamento ao recorrente, então nunca duplica.
- **Contas:** criar conta com e-mail e senha, entrar e sair. A sessão fica num cookie `httpOnly` e vale 30 dias. Cada conta vê apenas os próprios dados.
- **Configurações:** alterar nome, e-mail e senha, e excluir a conta com tudo o que há nela.
- **Administração (super admin):** listar e buscar contas, suspender e reativar, redefinir senha com uma provisória de uso único e excluir contas, além dos números de uso do sistema.
- **Categorias:** criar, editar (nome e cor) e excluir. Renomear atualiza também os lançamentos e recorrentes da categoria. Categoria em uso não pode ser excluída.

## API

Base: `/api`. Erros de validação voltam como `{ "error": "mensagem" }` com status 400, 404 ou 409.

| Recurso             | Rotas                                    |
| ------------------- | ---------------------------------------- |
| `/api/auth`         | `POST /registrar`, `POST /login`, `POST /logout`, `GET /eu`, `PATCH /perfil`, `POST /senha`, `DELETE /conta` |
| `/api/admin`        | `GET /usuarios`, `GET /metricas`, `PATCH /usuarios/:id/status`, `POST /usuarios/:id/senha`, `DELETE /usuarios/:id` |
| `/api/transactions` | `GET` (filtros e paginação), `POST`, `PUT /:id`, `DELETE /:id` |
| `/api/resumo`       | `GET ?mes=AAAA-MM` (dados do dashboard) |
| `/api/contas`       | `GET`, `POST`, `PUT /:id`, `DELETE /:id` |
| `/api/transferencias` | `GET`, `POST`, `DELETE /:id` |
| `/api/recorrentes`  | `GET ?mes=`, `POST`, `PUT /:id`, `DELETE /:id`, `POST /:id/lancar`, `POST /lancar-pendentes` |
| `/api/importacao`   | `POST /previa`, `POST /confirmar` |
| `/api/categorias`   | `GET`, `POST`, `PUT /:id`, `DELETE /:id` |

Formatos:

- **transactions:** `{ desc, valor, tipo: "entrada" | "saida", categoria_id | cat, conta_id?, data: "AAAA-MM-DD", obs? }` (sem `conta_id`, vai para a conta principal)
- **GET /transactions:** `?mes=AAAA-MM&tipo=&categoria_id=&conta_id=&q=&pagina=1&limite=20` (máx. 100) devolve `{ itens, total, pagina, paginas, limite, totais: { entradas, saidas, saldo } }`; os totais valem para todo o filtro, não só para a página
- **contas:** `{ nome, tipo: "corrente" | "poupanca" | "carteira" | "investimento", saldo_inicial?, cor?, arquivada? }`
- **transferencias:** `{ origem_id, destino_id, valor, data, descricao? }`
- **importação:** `previa { conta_id, conteudo }` devolve os itens com `categoria_id` sugerida e `duplicada` (`"importada"` ou `"provavel"`); `confirmar { conta_id, itens }` grava e devolve `{ importados, ignorados }`
- **recorrentes:** `{ nome, valor, tipo: "fixo" | "recorrente", categoria_id | cat, dia: 1–31, obs? }`
- **categorias:** `{ nome, cor: "#RRGGBB" }`

Dinheiro é guardado em **centavos inteiros** (`valor_centavos`) e a API fala em reais com até 2 casas (`19.99`); a conversão acontece só na borda (`backend/lib/money.js`). Lançamentos e recorrentes apontam para a categoria por **`categoria_id`** (FK). As respostas trazem `categoria_id` e também `cat` (o nome); ao gravar, vale enviar qualquer um dos dois, sempre dentro das categorias da própria conta. Tudo pertence a um usuário (`user_id`). Fora `/api/auth`, todas as rotas exigem sessão; as de `/api/admin` exigem papel de super admin. As senhas são guardadas como hash scrypt com sal.

## Estrutura

```
backend/
  app.js, server.js      App Express (testável) e processo que abre a porta
  db.js                  Conexão SQLite, backup antes de migrar, categorias padrão
  migrations/            Schema versionado (PRAGMA user_version): 001 baseline, 002 centavos e categoria_id, 003 contas e vínculos
  lib/                   auth (senhas, sessões), money (centavos), schemas (zod), categorias
  routes/                auth, admin, transactions, resumo, contas, transferencias, recorrentes, importacao, categorias
  lib/importacao/        Leitores de OFX e CSV, ids de deduplicação e sugestão de categoria
  scripts/create-admin   Cria ou promove o super admin
  tests/                 Testes com node:test + supertest (banco em memória)
.github/workflows/       CI: testes do backend, lint e build do front
src/
  context/               Sessão (AuthContext) e dados financeiros (FinanceContext)
  sections/              Auth, Dashboard, Lancamentos, Contas, Importar, Recorrentes, Categorias, Configuracoes, Admin
  components/            Sidebar, MonthStepper, Select, Toast
  utils/                 Formatadores e funções de período
  index.css              Estilos
```

O banco `backend/financeiro.db` é criado na primeira execução e não é versionado (guarda contas e dados financeiros).

## Migrações do banco

O schema é versionado em `backend/migrations/` e aplicado sozinho ao subir a API. Antes de migrar um banco que já tem dados, o app grava uma cópia ao lado do arquivo (`financeiro.db.backup-v<versão>-<data>`). Cada migração roda numa transação: se falhar, nada muda. Para alterar o schema, crie `NNN_nome.js` com `{ version, name, up(db) }`, registre em `migrations/index.js` e nunca edite uma migração já publicada.

## Testes

```bash
cd backend && npm test
```

Cobrem as migrações (inclusive a partir de um banco legado), conversão de dinheiro, autenticação, CRUD e, principalmente, o isolamento entre contas. A CI roda isso (Node 22 e 24) e também o lint e o build do front a cada push.
