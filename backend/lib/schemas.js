const { z } = require('zod');
const { validarValor } = require('./money');
const { dataNaFaixa, mensagemFaixa } = require('./datas');

// Mensagens de tipo do zod em português ("esperava um número, recebeu um texto").
z.config(z.locales.ptBR ? z.locales.ptBR() : z.locales.pt());

// Converte e valida dinheiro (número ou texto com ponto, até 2 casas, até R$ 1 bilhão) para centavos.
// `msgPositivo` troca a mensagem de "maior que zero" pela do campo; `naoNegativo` recusa só os negativos.
function converter(v, ctx, { sinal = false, msgPositivo, naoNegativo } = {}) {
  const r = validarValor(v, { sinal });
  let erro = r.erro;
  if (erro === 'O valor deve ser maior que zero.' && msgPositivo) erro = msgPositivo;
  // "O limite deve ser maior que zero." -> "O limite deve ser um número, ...": a mensagem cita o campo.
  if (erro?.startsWith('Valor inválido') && msgPositivo) erro = `${msgPositivo.split(' deve ')[0]} deve ser um número, com ponto antes dos centavos (ex.: 1234.56).`;
  if (!erro && naoNegativo && r.centavos < 0) erro = naoNegativo;
  if (erro) { ctx.addIssue({ code: 'custom', message: erro }); return z.NEVER; }
  return r.centavos;
}
const { ICONES } = require('./icones');

const texto = (rotulo, max = 120) =>
  z.string({ error: `Informe ${rotulo}.` }).trim().min(1, `Informe ${rotulo}.`).max(max, `Máximo de ${max} caracteres.`);

const valor = z.union([z.number(), z.string()], { error: 'O valor deve ser maior que zero.' })
  .transform((v, ctx) => {
    return converter(v, ctx);
  });

const obs = z.string().max(500, 'A observação deve ter até 500 caracteres.').optional().default('');

// A categoria vem por id (preferido) ou, por compatibilidade, pelo nome.
const categoria = {
  conta_id: z.number().int().positive().optional(),
  categoria_id: z.number().int().positive().optional(),
  cat: z.string().trim().min(1).optional(),
};
const exigeCategoria = (v) => v.categoria_id !== undefined || v.cat !== undefined;
const msgCategoria = { message: 'Informe a categoria.', path: ['cat'] };

const dataISO = z.string({ error: 'A data deve estar no formato AAAA-MM-DD.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'A data deve estar no formato AAAA-MM-DD.')
  .refine(s => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
  }, 'Data inexistente.');

// Data que vai ser gravada: além do formato, fica entre 2000 e hoje + `anos` (ver lib/datas).
const dataGravavel = (anos = 10) => dataISO.superRefine((s, ctx) => {
  if (!dataNaFaixa(s, anos)) ctx.addIssue({ code: 'custom', message: mensagemFaixa(anos) });
});

const transacao = z.object({
  desc: texto('a descrição', 120),
  parcelas: z.number({ error: 'O número de parcelas deve ser de 1 a 48.' }).int('O número de parcelas deve ser de 1 a 48.')
    .min(1, 'O número de parcelas deve ser de 1 a 48.').max(48, 'O número de parcelas deve ser de 1 a 48.').optional().default(1),
  valor,
  tipo: z.enum(['entrada', 'saida'], { error: 'O tipo deve ser "entrada" ou "saida".' }),
  data: dataGravavel(),
  obs,
  ...categoria,
}).refine(exigeCategoria, msgCategoria);

const recorrente = z.object({
  nome: texto('o nome', 80),
  valor,
  tipo: z.enum(['fixo', 'recorrente'], { error: 'O tipo deve ser "fixo" ou "recorrente".' }),
  dia: z.number({ error: 'O dia do vencimento deve estar entre 1 e 31.' })
    .int('O dia do vencimento deve estar entre 1 e 31.')
    .min(1, 'O dia do vencimento deve estar entre 1 e 31.')
    .max(31, 'O dia do vencimento deve estar entre 1 e 31.'),
  automatico: z.boolean({ error: 'Valor inválido para lançamento automático.' }).optional().default(false),
  obs,
  ...categoria,
}).refine(exigeCategoria, msgCategoria);

const COR = z.string({ error: 'A cor deve estar no formato #RRGGBB.' }).regex(/^#[0-9a-fA-F]{6}$/, 'A cor deve estar no formato #RRGGBB.');

const conta = z.object({
  nome: texto('o nome da conta', 40),
  tipo: z.enum(['corrente', 'poupanca', 'carteira', 'investimento', 'cartao'], { error: 'Tipo de conta inválido.' }),
  cor: COR.optional().default('#4d9fff'),
  saldo_inicial: z.union([z.number(), z.string()]).optional().default(0)
    .transform((v, ctx) => {
      return converter(v, ctx, { sinal: true });
    }),
  arquivada: z.boolean().optional(),
});

const transferencia = z.object({
  origem_id: z.number({ error: 'Escolha a conta de origem.' }).int().positive('Escolha a conta de origem.'),
  destino_id: z.number({ error: 'Escolha a conta de destino.' }).int().positive('Escolha a conta de destino.'),
  valor,
  data: dataGravavel(),
  descricao: z.string().trim().max(120, 'A descrição deve ter até 120 caracteres.').optional().default(''),
}).refine(v => v.origem_id !== v.destino_id, { message: 'Origem e destino devem ser contas diferentes.', path: ['destino_id'] });

const dia = rotulo => z.number({ error: `O dia de ${rotulo} deve estar entre 1 e 31.` }).int(`O dia de ${rotulo} deve estar entre 1 e 31.`)
  .min(1, `O dia de ${rotulo} deve estar entre 1 e 31.`).max(31, `O dia de ${rotulo} deve estar entre 1 e 31.`);

const cartao = z.object({
  nome: texto('o nome do cartão', 40),
  limite: z.union([z.number(), z.string()], { error: 'O limite deve ser maior que zero.' })
    .transform((v, ctx) => {
      return converter(v, ctx, { msgPositivo: 'O limite deve ser maior que zero.' });
    }),
  dia_fechamento: dia('fechamento'),
  dia_vencimento: dia('vencimento'),
  cor: COR.optional().default('#7c3aed'),
  conta_pagamento_id: z.number().int().positive().nullable().optional(),
  divida_inicial: z.union([z.number(), z.string()]).optional().default(0)
    .transform((v, ctx) => {
      return converter(v, ctx, { sinal: true, naoNegativo: 'A dívida inicial deve ser zero ou maior.' });
    }),
  arquivada: z.boolean().optional(),
});

const pagamentoFatura = z.object({
  origem_id: z.number({ error: 'Escolha a conta que vai pagar.' }).int().positive('Escolha a conta que vai pagar.'),
  valor: z.union([z.number(), z.string()]).optional()
    .transform((v, ctx) => {
      if (v === undefined) return undefined;
      return converter(v, ctx, { msgPositivo: 'O valor deve ser maior que zero.' });
    }),
  data: dataGravavel().optional(),
});

const meta = z.object({
  nome: texto('o nome da meta', 60),
  valor_alvo: z.union([z.number(), z.string()], { error: 'O valor da meta deve ser maior que zero.' })
    .transform((v, ctx) => {
      return converter(v, ctx, { msgPositivo: 'O valor da meta deve ser maior que zero.' });
    }),
  prazo: dataGravavel(50).nullable().optional(),
  cor: COR.optional().default('#22a84a'),
  valor_inicial: z.union([z.number(), z.string()]).optional()
    .transform((v, ctx) => {
      if (v === undefined || v === '') return undefined;
      return converter(v, ctx, { msgPositivo: 'O valor inicial deve ser maior que zero.' });
    }),
  arquivada: z.boolean().optional(),
});

const contaPagar = z.object({
  descricao: texto('a descrição', 120),
  valor,
  vencimento: dataGravavel(),
  obs,
  ...categoria,
}).refine(exigeCategoria, msgCategoria);

const pagarConta = z.object({
  data: dataGravavel().optional(),
  conta_id: z.number().int().positive().optional(),
});

const aporte = z.object({
  valor: z.union([z.number(), z.string()], { error: 'O valor deve ser maior que zero.' })
    .transform((v, ctx) => {
      return converter(v, ctx, { msgPositivo: 'O valor deve ser maior que zero.' });
    }),
  tipo: z.enum(['aporte', 'retirada'], { error: 'O tipo deve ser "aporte" ou "retirada".' }).optional().default('aporte'),
  data: dataGravavel().optional(),
  obs: z.string().max(200, 'A observação deve ter até 200 caracteres.').optional().default(''),
});

const categoriaInput = z.object({
  nome: texto('o nome da categoria', 40),
  cor: COR,
  // Opcional: quem não manda (clientes antigos) mantém o ícone atual ao editar e recebe o genérico ao criar.
  icone: z.enum(ICONES, { error: 'Escolha um ícone da lista.' }).optional(),
});

const orcamento = z.object({
  limite: z.union([z.number(), z.string()], { error: 'O limite deve ser maior que zero.' })
    .transform((v, ctx) => {
      return converter(v, ctx, { msgPositivo: 'O limite deve ser maior que zero.' });
    }),
});

// Devolve { value } ou { error } com a primeira mensagem, no formato que as rotas já usavam.
// Nome do campo para as mensagens automáticas do zod, que não sabem de qual campo falam.
const NOMES = {
  conta_id: 'Conta', categoria_id: 'Categoria', cat: 'Categoria', origem_id: 'Conta de origem', destino_id: 'Conta de destino',
  conta_pagamento_id: 'Conta de pagamento', parcelas: 'Parcelas', dia: 'Dia', obs: 'Observação', automatico: 'Lançamento automático',
  arquivada: 'Arquivada', descricao: 'Descrição', desc: 'Descrição', nome: 'Nome', prazo: 'Prazo', data: 'Data', vencimento: 'Vencimento',
};

function validar(schema, body) {
  const r = schema.safeParse(body ?? {});
  if (r.success) return { value: r.data };
  const issue = r.error.issues[0];
  if (!issue) return { error: 'Dados inválidos.' };
  const nome = issue.code !== 'custom' && NOMES[issue.path?.[0]];
  return { error: nome && !issue.message.startsWith('Informe') ? `${nome}: ${issue.message.replace(/^Entrada inválida: /, '')}.` : issue.message };
}

module.exports = { transacao, recorrente, categoriaInput, conta, cartao, pagamentoFatura, meta, aporte, contaPagar, pagarConta, transferencia, orcamento, dataISO, validar };
