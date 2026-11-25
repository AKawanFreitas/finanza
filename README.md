# Finanza

Controle financeiro pessoal em formato SaaS: cada pessoa tem a sua conta, com lançamentos, gastos recorrentes, categorias e um resumo mensal. Um super admin administra as contas.

- **Front:** React 18 + Vite
- **Back:** Express + SQLite (`better-sqlite3`)

## Como rodar

Precisa do Node.js (testado na versão 24). Na raiz do projeto:

```bash
npm run setup   # só na primeira vez: instala as dependências do front e do backend
npm run dev     # sobe a API (porta 4747) e o front (porta 5173) no mesmo terminal
```

Abra http://localhost:5173. O Vite encaminha as chamadas `/api` para o backend. No terminal, cada linha vem marcada com `[api]` ou `[web]`, e um Ctrl+C encerra os dois. Para subir só um deles, use `npm run dev:api` ou `npm run dev:web`.

### Contas de teste (jeito rápido)

Crie um `.env` (o `.env.example` explica cada variável) com as contas que quer ter. Ao subir, a API cria sozinha um super admin e um usuário com 5 meses de dados de exemplo, já com o e-mail confirmado:

```bash
cp .env.example .env
# edite o .env: descomente as linhas BOOTSTRAP_* e escolha as senhas (8+ caracteres)
cd backend && npm run dev     # e, na raiz, npm run dev para o front
```

As contas só são **criadas**: se o e-mail já existe, nada é alterado (reiniciar não desfaz uma senha trocada nem apaga dados). O `.env` não vai para o git, então as senhas ficam só na sua máquina. Em um servidor de verdade, não use `BOOTSTRAP_*`.

### Primeiro acesso (manual)

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
| `APP_URL`  | backend | `http://localhost:5173` | Endereço do front, usado nos links dos e-mails |
| `SMTP_URL` | backend | —                       | Servidor de e-mail, ex.: `smtps://usuario:senha@smtp.exemplo.com`. Sem ele, os e-mails aparecem no console da API |
| `EMAIL_FROM` | backend | `Finanza <nao-responda@finanza.local>` | Remetente dos e-mails |
| `BACKUP_DIR` | backend | — | Pasta dos backups diários do banco. Sem ela, o agendador não faz backup (o Docker define `/data/backups`) |
| `BACKUP_KEEP` | backend | `7` | Quantos backups manter |
| `LOG_LEVEL` | backend | `info` | Nível dos logs JSON (`debug`, `info`, `warn`, `error`, `silent`) |
| `STATIC_DIR` | backend | `../dist` | Onde está o front compilado; se existir, a própria API o serve |
| `COOKIE_SECURE` | backend | `true` em produção | `false` permite o build de produção em `http://localhost` |
| `TRUST_PROXY` | backend | — | Atrás de um proxy reverso, `1` faz o IP dos limites de tentativa ser o do cliente |
| `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_SENHA`, `BOOTSTRAP_ADMIN_NOME` | backend | — | Cria um super admin ao subir, se o e-mail não existir (senha com 8+ caracteres) |
| `BOOTSTRAP_DEMO`, `BOOTSTRAP_DEMO_EMAIL`, `BOOTSTRAP_DEMO_SENHA` | backend | `false`, `demo@finanza.local`, `demo1234` | Com `BOOTSTRAP_DEMO=true`, cria um usuário com 5 meses de dados de exemplo |

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
- **Recorrentes:** cadastro de despesas mensais (fixas ou variáveis). Cada uma pode ser lançada como gasto do mês atual, uma a uma ou todas as pendentes. O servidor liga o lançamento ao recorrente, então nunca duplica. Marcando **lançar automaticamente**, o servidor faz o lançamento sozinho no vencimento, na conta escolhida (se ficou fora do ar, recupera na volta, com a data certa).
- **Cartões de crédito:** limite, dia de fechamento e de vencimento. Cada compra cai na fatura certa pela data (a fatura é calculada, não gravada), com **parcelamento** de 2 a 48 vezes (uma parcela por fatura, somando exatamente o total). Mostra limite usado e disponível, status da fatura (aberta, fechada, vencida, paga em parte, paga) e permite pagar a fatura, inteira ou em parte, a partir de uma conta. O pagamento é uma transferência, então o gasto nunca é contado duas vezes. O saldo de um cartão é a dívida, e o saldo total das contas já a desconta.
- **Metas e reservas:** objetivo com valor e prazo opcional, alimentado por aportes e retiradas (uma "caixinha" da meta, sem mexer no saldo das contas). Mostra progresso, quanto guardar por mês até o prazo e avisa por e-mail quando a meta é atingida.
- **Contas a pagar:** boletos e contas com vencimento, com status pendente, atrasada ou paga. Pagar gera o gasto na conta escolhida (e desfazer o remove); apagar o lançamento gerado reabre a conta. O painel do Resumo lista os próximos vencimentos, incluindo faturas de cartão, e um e-mail agrupado lembra do que vence em até 3 dias ou está atrasado.
- **Orçamentos:** limite mensal por categoria, com barra de progresso (verde, amarelo a partir de 80%, vermelho a partir de 100%) no dashboard e numa tela própria. Por e-mail, avisa quando a categoria chega a 80% e a 100%, uma vez por nível a cada mês.
- **Exportar:** o histórico de lançamentos sai em CSV (abre direto no Excel em português) ou XLSX (com aba de resumo por categoria), respeitando os filtros da tela.
- **E-mail:** recuperação de senha (link de uso único, válido por 1 hora), confirmação de e-mail, alertas de orçamento e resumo do mês anterior nos primeiros dias do mês. Os avisos só vão para quem confirmou o e-mail e podem ser desligados em Configurações.
- **Contas:** criar conta com e-mail e senha, entrar e sair. A sessão fica num cookie `httpOnly` e vale 30 dias. Cada conta vê apenas os próprios dados.
- **Configurações:** alterar nome, e-mail e senha, e excluir a conta com tudo o que há nela.
- **Administração (super admin):** listar e buscar contas, suspender e reativar, redefinir senha com uma provisória de uso único e excluir contas, além dos números de uso do sistema.
- **Categorias:** criar, editar (nome e cor) e excluir. Renomear atualiza também os lançamentos e recorrentes da categoria. Categoria em uso não pode ser excluída.

## API

Base: `/api`. Erros de validação voltam como `{ "error": "mensagem" }` com status 400, 404 ou 409.

| Recurso             | Rotas                                    |
| ------------------- | ---------------------------------------- |
| `/api/auth`         | `POST /registrar`, `POST /login`, `POST /logout`, `GET /eu`, `PATCH /perfil`, `PATCH /preferencias`, `POST /senha`, `DELETE /conta`, `POST /esqueci-senha`, `POST /redefinir-senha`, `POST /verificar-email`, `POST /reenviar-verificacao` |
| `/api/admin`        | `GET /usuarios`, `GET /metricas`, `PATCH /usuarios/:id/status`, `POST /usuarios/:id/senha`, `DELETE /usuarios/:id` |
| `/api/transactions` | `GET` (filtros e paginação), `POST`, `PUT /:id`, `DELETE /:id` |
| `/api/resumo`       | `GET ?mes=AAAA-MM` (dados do dashboard) |
| `/api/contas`       | `GET`, `POST`, `PUT /:id`, `DELETE /:id` |
| `/api/transferencias` | `GET`, `POST`, `DELETE /:id` |
| `/api/recorrentes`  | `GET ?mes=`, `POST`, `PUT /:id`, `DELETE /:id`, `POST /:id/lancar`, `POST /lancar-pendentes` |
| `/api/importacao`   | `POST /previa`, `POST /confirmar` |
| `/api/orcamentos`   | `GET ?mes=`, `PUT /:categoriaId`, `DELETE /:categoriaId` |
| `/api/exportacao`   | `GET /lancamentos?formato=csv\|xlsx` (+ filtros da listagem) |
| `/api/cartoes`      | `GET`, `POST`, `PUT /:id`, `DELETE /:id`, `GET /:id/faturas`, `GET /:id/faturas/:mes`, `POST /:id/faturas/:mes/pagar` |
| `/api/metas`        | `GET`, `POST`, `PUT /:id`, `DELETE /:id`, `GET /:id/aportes`, `POST /:id/aportes`, `DELETE /:id/aportes/:aporteId` |
| `/api/contas-pagar` | `GET ?status=&mes=`, `POST`, `PUT /:id`, `DELETE /:id`, `POST /:id/pagar`, `POST /:id/desfazer` |
| `/api/categorias`   | `GET`, `POST`, `PUT /:id`, `DELETE /:id` |
| `/api/health`       | `GET` (para o healthcheck) |

Formatos:

- **transactions:** `{ desc, valor, tipo: "entrada" | "saida", categoria_id | cat, conta_id?, data: "AAAA-MM-DD", obs? }` (sem `conta_id`, vai para a conta principal)
- **GET /transactions:** `?mes=AAAA-MM&tipo=&categoria_id=&conta_id=&q=&pagina=1&limite=20` (máx. 100) devolve `{ itens, total, pagina, paginas, limite, totais: { entradas, saidas, saldo } }`; os totais valem para todo o filtro, não só para a página
- **contas:** `{ nome, tipo: "corrente" | "poupanca" | "carteira" | "investimento", saldo_inicial?, cor?, arquivada? }` (cartões são criados em `/api/cartoes`)
- **cartoes:** `{ nome, limite, dia_fechamento, dia_vencimento, cor?, conta_pagamento_id?, divida_inicial? }`; pagar fatura: `{ origem_id, valor?, data? }` (sem `valor`, paga o restante)
- **compra parcelada:** `POST /transactions` com `parcelas: 2–48` numa conta de cartão cria uma parcela por mês; `DELETE /transactions/:id?parcelas=todas|futuras` remove a compra ou as parcelas seguintes
- **metas:** `{ nome, valor_alvo, prazo?, cor?, valor_inicial? }`; aporte: `{ valor, tipo: "aporte" | "retirada", data?, obs? }`
- **contas a pagar:** `{ descricao, valor, vencimento, categoria_id | cat, conta_id?, obs? }`; pagar: `{ conta_id?, data? }`
- **orcamentos:** `PUT { limite }` em reais; `GET` devolve `{ mes, itens: [{ categoria_id, cat, limite, gasto, restante, percentual, status: "ok" | "atencao" | "estourado" }], totais }`
- **transferencias:** `{ origem_id, destino_id, valor, data, descricao? }`
- **importação:** `previa { conta_id, conteudo }` devolve os itens com `categoria_id` sugerida e `duplicada` (`"importada"` ou `"provavel"`); `confirmar { conta_id, itens }` grava e devolve `{ importados, ignorados }`
- **recorrentes:** `{ nome, valor, tipo: "fixo" | "recorrente", categoria_id | cat, dia: 1–31, automatico?, conta_id?, obs? }`
- **categorias:** `{ nome, cor: "#RRGGBB" }`

Dinheiro é guardado em **centavos inteiros** (`valor_centavos`) e a API fala em reais com até 2 casas (`19.99`); a conversão acontece só na borda (`backend/lib/money.js`). Lançamentos e recorrentes apontam para a categoria por **`categoria_id`** (FK). As respostas trazem `categoria_id` e também `cat` (o nome); ao gravar, vale enviar qualquer um dos dois, sempre dentro das categorias da própria conta. Tudo pertence a um usuário (`user_id`). Fora `/api/auth`, todas as rotas exigem sessão; as de `/api/admin` exigem papel de super admin. As senhas são guardadas como hash scrypt com sal.

## Estrutura

```
backend/
  app.js, server.js      App Express (testável) e processo que abre a porta
  db.js                  Conexão SQLite, cópia de segurança antes de migrar, categorias padrão
  migrations/            Schema versionado (PRAGMA user_version): 001 baseline, 002 centavos e categoria_id, 003 contas e vínculos, 004 automação, orçamentos e e-mail, 005 limites, 006 cartão de crédito, 007 metas, 008 contas a pagar
  lib/                   auth (senhas, sessões), money (centavos), schemas (zod), categorias
  routes/                auth, admin, transactions, resumo, contas, transferencias, recorrentes, importacao, orcamentos, exportacao, cartoes, metas, contasPagar, categorias
  lib/importacao/        Leitores de OFX e CSV, ids de deduplicação e sugestão de categoria
  lib/agendador.js       Tarefas por hora: recorrentes automáticos, resumo mensal, limpeza (idempotentes)
  lib/cartoes.js, parcelas.js, metas.js, contasPagar.js, vencimentos.js, lembretes.js   Faturas e parcelas, metas, contas a pagar e lembretes
  lib/backup.js, limite.js, csrf.js, logger.js   Backup diário, limites de tentativa no banco, checagem de origem, logs JSON
  lib/email.js, templates.js, tokens.js, notificar.js   E-mail (SMTP ou console), textos, links de uso único e envio sem repetir
  scripts/               create-admin (cria ou promove o super admin) e backup
  tests/                 Testes com node:test + supertest (banco em memória)
Dockerfile, docker-compose.yml   Imagem de produção (API + front) e execução com volume de dados
.github/workflows/       CI: testes do backend, lint e build do front, build da imagem Docker
src/
  context/               Sessão (AuthContext) e dados financeiros (FinanceContext)
  sections/              Auth, Dashboard, Lancamentos, Contas, Cartoes, Metas, ContasPagar, Importar, Orcamentos, Recorrentes, Categorias, Configuracoes, Admin
  components/            Sidebar, MonthStepper, Select, Toast, diálogos e barras de progresso
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

## E-mail em desenvolvimento

Sem `SMTP_URL`, nada é enviado: o conteúdo de cada e-mail (inclusive o link de redefinir senha ou confirmar e-mail) aparece no console da API. Para testar de verdade, aponte `SMTP_URL` para qualquer provedor SMTP e defina `APP_URL` com o endereço do front.

## Tarefas agendadas

A API roda, ao subir e a cada hora: recorrentes automáticos, resumo mensal, lembretes de vencimento (a partir das 7h, horário de Brasília), backup do dia e limpeza de sessões, tokens e limites vencidos. Tudo é idempotente (cada lançamento ou e-mail tem uma chave de controle), então reiniciar ou ter mais de uma instância não duplica nada. Ao escalar para várias instâncias, o ideal é rodar o agendador em um único processo.

## Docker

```bash
cp .env.example .env            # ajuste o que precisar
docker compose up -d --build    # abre em http://localhost:4747
docker compose exec finanza node backend/scripts/create-admin.js --email voce@exemplo.com --nome "Seu Nome"
```

A imagem compila o front, instala só as dependências de produção da API e roda como usuário comum, com healthcheck em `/api/health`. O banco e os backups ficam no volume `finanza-data` (`/data`). O `docker-compose.yml` vem com `COOKIE_SECURE=false` para funcionar em `http://localhost`; atrás de HTTPS, remova essa variável e defina `TRUST_PROXY=1` e `APP_URL`. A CI faz o build da imagem a cada push.

## Backup e restauração

Com `BACKUP_DIR` definido (o Docker já define), a API faz **um backup por dia** (`VACUUM INTO`, uma cópia consistente mesmo com a API em uso). Cada cópia é aberta e passa por `PRAGMA integrity_check` antes de valer, e só as últimas `BACKUP_KEEP` ficam no disco. Para fazer um agora: `cd backend && npm run backup` (ou `-- --dir /outra/pasta`).

Para restaurar, pare a API e troque o arquivo do banco por uma cópia:

```bash
docker compose stop finanza
docker compose run --rm --no-deps finanza sh -c 'cp /data/backups/finanza-AAAA-MM-DD-HHMMSS.db /data/financeiro.db && rm -f /data/financeiro.db-wal /data/financeiro.db-shm'
docker compose start finanza
```

## Segurança

- **Senhas** com scrypt e sal; **sessão** em cookie `httpOnly` + `SameSite=Lax` (+ `Secure` em produção), guardada só como hash.
- **CSRF:** requisições que alteram dados precisam vir do próprio host, de `APP_URL` ou de `CORS_ORIGIN` (checagem de `Origin`/`Sec-Fetch-Site`).
- **Limite de tentativas** de login (por e-mail e por IP) e de recuperação de senha, gravado no banco: não zera quando a API reinicia.
- **Isolamento entre contas** em todas as rotas, coberto por testes; links de redefinição e confirmação são de uso único e guardados só como hash.
- `helmet` (CSP, HSTS, etc.), validação de entrada com zod e logs sem cookies, com `X-Request-Id`.
