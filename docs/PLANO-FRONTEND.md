# Finanza — Varredura do front end e plano de melhorias

Escopo analisado: `src/` (≈4,9 mil linhas, 13 seções, 8 componentes compartilhados, 1 folha de CSS de 643 linhas), `index.html`, `public/`.

## 1. Diagnóstico

**O que já está bom (manter)**
- Identidade coerente: azul-marinho + verde da logo, Hanken Grotesk, números tabulares. Não é o "template" genérico; vale refinar, não trocar.
- Tokens de cor em `:root`, `prefers-reduced-motion` respeitado, `:focus-visible` global.
- Dashboard com dados prontos do servidor, estados vazios com ação, modais com `role="dialog"`.

**Problemas encontrados (por gravidade)**

| # | Área | Problema | Evidência |
|---|------|----------|-----------|
| 1 | Acessibilidade | Nenhum `<label>` ligado ao campo (`htmlFor`/`id`): 65 labels, 0 `htmlFor`. Leitor de tela e clique no rótulo não funcionam. | `grep htmlFor` = 0 |
| 2 | Acessibilidade | `Select` customizado é só `<button>`: sem `role=listbox`, sem setas/Home/End, sem `aria-expanded`. Usado em todos os formulários e filtros. | `components/Select.jsx` |
| 3 | Acessibilidade | Modais sem focus trap nem retorno de foco; botões só-ícone dependem de `title` (22 usos), não de `aria-label`. Toast sem `aria-live`. | `ExcluirParcelas`, `PagarConta`, `Toast` |
| 4 | UX | Exclusão inconsistente: lançamento, transferência, conta, recorrente e categoria apagam **com um clique, sem confirmação nem desfazer**; Meta usa `window.confirm` nativo. | `del-btn` em 5 listas; `MetaCard.jsx:52` |
| 5 | Navegação | 11 itens no menu lateral, sem agrupamento. No celular viram 11 colunas numa barra de 360 px (rótulos de 11,5 px ilegíveis). Seção atual não vive na URL: F5 volta ao Resumo, voltar do navegador sai do app. | `Sidebar.jsx`, `App.jsx` (useState) |
| 6 | UX | Formulário de lançamento ocupa o topo da tela e empurra o histórico para baixo; para editar, a página rola ao topo. Fluxo mais frequente do app exige mais cliques do que deveria. | `Lancamentos.jsx` |
| 7 | Consistência | Duas famílias de cabeçalho (`page-bar` vs `page-header`), `h1` ora é `<h1>`, ora `<div>`; `section-enter` é `animation: none`. Carregamento é texto "Carregando..." (13 ocorrências), Dashboard devolve `null` enquanto carrega (tela em branco). | `Lancamentos.jsx`, `Dashboard.jsx:30` |
| 8 | Código CSS | `index.css` monolítico; ~40 `style={{}}` inline (cores de categoria são legítimas, o resto não); cores soltas fora dos tokens (`#fafbfc`, `#a9b8cc`, `#e6c3c0`…); `App.css` é sobra do template Vite (e `src/assets/react.svg`, `public/vite.svg`) e o `#root` dele não está importado. Fontes de 10–12 px em 14 regras. | `App.css`, `index.css` |
| 9 | Tipografia/dados | "▲ ▼" como texto em chips, `✓` no texto do toast, hierarquia de números só por tamanho. Sem escala tipográfica nomeada. `Intl` ausente (formatação manual com `toLocaleString`). | `Dashboard.jsx:19`, `FinanceContext.jsx:80` |
| 10 | Tabelas/listas | Em telas ≤860 px o histórico esconde Categoria e Data (informação perdida, não reorganizada). Ações de linha só aparecem como ícones de 13 px (alvo de toque < 32 px). | `index.css:394`, `TransactionList.jsx:157` |
| 11 | Performance | Todas as seções importadas de forma estática (sem `lazy`); fonte do Google bloqueia em `index.html`; logo PNG sem dimensões. | `App.jsx`, `index.html` |
| 12 | Cobertura | Não há nenhum teste de front end nem Storybook; `lint` existe, mas sem checagem a11y (`eslint-plugin-jsx-a11y`). | `package.json` |

## 2. Direção visual

Manter a assinatura da marca e subir o nível de acabamento:

- **Cor**: navy `#1b2c47` (texto/estrutura), verde `#1f8a3b` (ação e ganho), vermelho `#cf3f3f` (gasto), âmbar `#a96a0a` (atenção), fundo `#edf1f4`. Toda cor passa a sair de token; nenhum hex solto.
- **Tipo**: Hanken Grotesk (uma família, sem segunda). Escala fixa: 12 / 13 / 14.5 / 17 / 22 / 28 / 36, pesos 500/600/800. Rótulos ≥ 12 px. Valores monetários sempre tabulares e alinhados à direita.
- **Layout**: conteúdo alinhado à esquerda, largura máxima 1240 px, ritmo de 8 px. Cartões só onde há agrupamento real; um raio de borda por nível (6 px painel, 4 px controle).
- **Uma coisa memorável**: o cartão de **Saldo do mês** (degradê da folha da logo) é o único elemento com gradiente; o resto fica calmo e tipográfico.
- **Movimento**: só em resposta a ação (abrir menu/modal, toast, barra de progresso ao mudar de mês). Sem entrada animada em seções.

## 3. Plano em etapas

Cada etapa é independente, entregável num PR e termina com `npm run lint && npm run build`.

### Etapa 0 — Limpeza e fundação (0,5 dia)
- Apagar `App.css`, `src/assets/react.svg`, `public/vite.svg`, `initialState.js` se não usado.
- Quebrar `index.css` em `styles/` (`tokens.css`, `base.css`, `layout.css`, `components.css`, `sections/*.css`), importados em `main.jsx`.
- Tokens novos: escala tipográfica, espaçamento, raios, sombras, `--z-*`; trocar hex soltos por variáveis; mínimo de 12 px.
- Adicionar `eslint-plugin-jsx-a11y`.
- **Pronto quando**: visual idêntico, zero hex fora de `tokens.css`, lint a11y rodando.

### Etapa 1 — Componentes base acessíveis (1–1,5 dia)
- `Field` (label + `id` gerado com `useId` + dica + erro) e aplicar nos 65 campos.
- `Select` reescrito como combobox/listbox (setas, Home/End, digitar para buscar, `aria-expanded`, Esc devolve foco).
- `Modal` único (focus trap, retorno de foco, Esc, `inert` no fundo) e migrar `ExcluirParcelas` e `PagarConta`.
- `IconButton` com `aria-label` obrigatório e alvo de 36 px; trocar todos os `title` + `del-btn`.
- `Toast` com `role="status"`/`aria-live`, ícone SVG no lugar de `✓`, botão **Desfazer** opcional.
- `Skeleton` e `EmptyState` compartilhados.
- **Pronto quando**: formulário inteiro navegável só por teclado; leitor de tela anuncia rótulos.

### Etapa 2 — Exclusão segura e feedback (0,5–1 dia)
- `useConfirm()` (usa `Modal`) para conta, categoria, recorrente, transferência e meta; remover `window.confirm`.
- Para lançamento: **excluir imediato + toast com Desfazer** (5 s), já que é a ação de maior volume.
- Mensagens padronizadas: o verbo do botão é o do toast ("Excluir" → "Excluído").
- **Pronto quando**: nenhuma exclusão acontece sem confirmação ou desfazer.

### Etapa 3 — Navegação e shell (1 dia)
- Roteamento por hash ou `react-router` (`/#/lancamentos`, mês em `?mes=`): F5, voltar e links funcionam; `lazy()` por seção com `Suspense` + skeleton.
- Menu agrupado: **Dia a dia** (Resumo, Lançamentos, Contas a pagar), **Dinheiro** (Contas, Cartões, Orçamentos, Metas), **Organização** (Recorrentes, Categorias, Importar). Conta/admin no rodapé.
- Mobile: barra inferior com 4 destinos (Resumo, Lançamentos, Contas a pagar, Mais) + folha "Mais"; botão flutuante **Novo lançamento**.
- Cabeçalho de página único (`PageHeader` com `h1`, subtítulo e ações) e `<title>` por seção.
- **Pronto quando**: toda tela tem URL própria e uma só estrutura de cabeçalho.

### Etapa 4 — Lançamentos: o fluxo central (1–1,5 dia)
- Formulário vira **painel lateral/modal "Novo lançamento"** aberto por botão (atalho `N`); lista passa a ser o foco da página.
- Edição abre o mesmo painel no lugar (sem rolar a página).
- Alternância Entrada/Saída com `role=radiogroup`; valor com máscara `R$` (`inputmode="decimal"`); parcelas só aparecem para cartão (já é assim).
- Lista: linha de 2 níveis no mobile (descrição + valor; categoria e data em segunda linha), cabeçalho de filtros recolhível, chips dos filtros ativos, ações de linha em menu "⋯" com alvo de 40 px.
- Linha de totais do filtro (entradas, saídas, saldo) fixa no rodapé da tabela.
- **Pronto quando**: adicionar um lançamento é ≤ 3 interações a partir de qualquer tela.

### Etapa 5 — Resumo (Dashboard) (1 dia)
- Esqueleto de carregamento no lugar de `null`; troca de mês sem piscar (já mantém dado anterior; trocar opacidade por barra fina de progresso).
- Hierarquia: Saldo (destaque) → "Próximos vencimentos" e "Orçamentos" **acima** dos gráficos, porque pedem ação; gráficos depois.
- Gráficos com texto alternativo e tabela equivalente oculta; cores de série com contraste ≥ 3:1; rótulos diretos em vez de legenda quando possível.
- `Intl.NumberFormat`/`Intl.DateTimeFormat` centralizados em `formatters.js`; `▲/▼` viram ícones Lucide.
- **Pronto quando**: o que exige ação do usuário aparece sem rolar em 1366×768.

### Etapa 6 — Demais seções (1,5 dia)
- Contas, Cartões, Orçamentos, Metas, Recorrentes, Categorias, Importar, Configurações, Admin: migrar para `PageHeader`, `Field`, `Modal`, `EmptyState` e tokens; remover `style={{}}` não dinâmicos.
- Importar: passos numerados (é de fato uma sequência: arquivo → conferir → confirmar) com revisão em tabela antes de gravar.
- Cartões: barra de limite usado e contagem de dias até fechar a fatura em cada cartão.
- Formulários de 2 colunas só ≥ 900 px; rótulos "(opcional)" padronizados.
- **Pronto quando**: nenhuma seção usa CSS próprio duplicado de painel, cabeçalho ou botão.

### Etapa 7 — Acabamento, performance e verificação (1 dia)
- `index.html`: `font-display: swap`, `preload` da fonte, `width/height` no logo, `theme-color`, favicon SVG; considerar auto-hospedar a fonte.
- Contraste AA em todos os pares texto/fundo (checar `--faint`, `--amber`, textos sobre o degradê).
- Alvos de toque ≥ 40 px em ≤ 860 px; teste em 360, 768, 1024, 1440.
- Tema escuro opcional (tokens já isolados na Etapa 0) — **só se for desejo do produto**.
- Testes: Vitest + Testing Library para `Field`, `Select`, `Modal`, `useConfirm`; Playwright cobrindo entrar → lançar → editar → desfazer.
- **Pronto quando**: Lighthouse ≥ 95 em acessibilidade e boas práticas, CLS < 0,05.

## 4. Ordem e esforço

`0 → 1 → 2 → 3 → 4 → 5 → 6 → 7`. Total ≈ 7–9 dias de uma pessoa. As etapas 0–2 têm o maior retorno (acessibilidade e segurança de uso) e não alteram o desenho visual; a 3 e a 4 são as que mais mudam a percepção do produto.

## 5. Riscos e decisões em aberto

- **Roteamento**: hash-route evita mexer no servidor Express; `react-router` com histórico exige fallback para `index.html` no backend (já há `estatico.test.js`, que precisaria cobrir isso).
- **Desfazer exclusão** de lançamento: pode ser feito só no cliente (adiar a chamada por 5 s) ou com "soft delete" no backend. Recomendo o cliente: sem migração.
- **Tema escuro** e **segunda família tipográfica** ficam fora do plano, a menos que você queira.
