const { z } = require('zod');
const { paraCentavos, paraCentavosComSinal } = require('./money');
const { ICONES } = require('./icones');

const texto = (rotulo, max = 120) =>
  z.string({ error: `Informe ${rotulo}.` }).trim().min(1, `Informe ${rotulo}.`).max(max, `Máximo de ${max} caracteres.`);

const valor = z.union([z.number(), z.string()], { error: 'O valor deve ser maior que zero.' })
  .transform((v, ctx) => {
    const centavos = paraCentavos(v);
    if (centavos === null) ctx.addIssue({ code: 'custom', message: 'O valor deve ser maior que zero.' });
    return centavos;
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

const transacao = z.object({
  desc: texto('a descrição', 120),
  parcelas: z.number({ error: 'O número de parcelas deve ser de 1 a 48.' }).int('O número de parcelas deve ser de 1 a 48.')
    .min(1, 'O número de parcelas deve ser de 1 a 48.').max(48, 'O número de parcelas deve ser de 1 a 48.').optional().default(1),
  valor,
  tipo: z.enum(['entrada', 'saida'], { error: 'O tipo deve ser "entrada" ou "saida".' }),
  data: dataISO,
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
      const c = paraCentavosComSinal(v);
      if (c === null) ctx.addIssue({ code: 'custom', message: 'Saldo inicial inválido.' });
      return c;
    }),
  arquivada: z.boolean().optional(),
});

const transferencia = z.object({
  origem_id: z.number({ error: 'Escolha a conta de origem.' }).int().positive('Escolha a conta de origem.'),
  destino_id: z.number({ error: 'Escolha a conta de destino.' }).int().positive('Escolha a conta de destino.'),
  valor,
  data: dataISO,
  descricao: z.string().trim().max(120, 'A descrição deve ter até 120 caracteres.').optional().default(''),
}).refine(v => v.origem_id !== v.destino_id, { message: 'Origem e destino devem ser contas diferentes.', path: ['destino_id'] });

const dia = rotulo => z.number({ error: `O dia de ${rotulo} deve estar entre 1 e 31.` }).int(`O dia de ${rotulo} deve estar entre 1 e 31.`)
  .min(1, `O dia de ${rotulo} deve estar entre 1 e 31.`).max(31, `O dia de ${rotulo} deve estar entre 1 e 31.`);

const cartao = z.object({
  nome: texto('o nome do cartão', 40),
  limite: z.union([z.number(), z.string()], { error: 'O limite deve ser maior que zero.' })
    .transform((v, ctx) => {
      const c = paraCentavos(v);
      if (c === null) ctx.addIssue({ code: 'custom', message: 'O limite deve ser maior que zero.' });
      return c;
    }),
  dia_fechamento: dia('fechamento'),
  dia_vencimento: dia('vencimento'),
  cor: COR.optional().default('#7c3aed'),
  conta_pagamento_id: z.number().int().positive().nullable().optional(),
  divida_inicial: z.union([z.number(), z.string()]).optional().default(0)
    .transform((v, ctx) => {
      const c = paraCentavosComSinal(v);
      if (c === null || c < 0) ctx.addIssue({ code: 'custom', message: 'A dívida inicial deve ser zero ou maior.' });
      return c;
    }),
  arquivada: z.boolean().optional(),
});

const pagamentoFatura = z.object({
  origem_id: z.number({ error: 'Escolha a conta que vai pagar.' }).int().positive('Escolha a conta que vai pagar.'),
  valor: z.union([z.number(), z.string()]).optional()
    .transform((v, ctx) => {
      if (v === undefined) return undefined;
      const c = paraCentavos(v);
      if (c === null) ctx.addIssue({ code: 'custom', message: 'O valor deve ser maior que zero.' });
      return c;
    }),
  data: dataISO.optional(),
});

const meta = z.object({
  nome: texto('o nome da meta', 60),
  valor_alvo: z.union([z.number(), z.string()], { error: 'O valor da meta deve ser maior que zero.' })
    .transform((v, ctx) => {
      const c = paraCentavos(v);
      if (c === null) ctx.addIssue({ code: 'custom', message: 'O valor da meta deve ser maior que zero.' });
      return c;
    }),
  prazo: dataISO.nullable().optional(),
  cor: COR.optional().default('#22a84a'),
  valor_inicial: z.union([z.number(), z.string()]).optional()
    .transform((v, ctx) => {
      if (v === undefined || v === '') return undefined;
      const c = paraCentavos(v);
      if (c === null) ctx.addIssue({ code: 'custom', message: 'O valor inicial deve ser maior que zero.' });
      return c;
    }),
  arquivada: z.boolean().optional(),
});

const contaPagar = z.object({
  descricao: texto('a descrição', 120),
  valor,
  vencimento: dataISO,
  obs,
  ...categoria,
}).refine(exigeCategoria, msgCategoria);

const pagarConta = z.object({
  data: dataISO.optional(),
  conta_id: z.number().int().positive().optional(),
});

const aporte = z.object({
  valor: z.union([z.number(), z.string()], { error: 'O valor deve ser maior que zero.' })
    .transform((v, ctx) => {
      const c = paraCentavos(v);
      if (c === null) ctx.addIssue({ code: 'custom', message: 'O valor deve ser maior que zero.' });
      return c;
    }),
  tipo: z.enum(['aporte', 'retirada'], { error: 'O tipo deve ser "aporte" ou "retirada".' }).optional().default('aporte'),
  data: dataISO.optional(),
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
      const c = paraCentavos(v);
      if (c === null) ctx.addIssue({ code: 'custom', message: 'O limite deve ser maior que zero.' });
      return c;
    }),
});

// Devolve { value } ou { error } com a primeira mensagem, no formato que as rotas já usavam.
function validar(schema, body) {
  const r = schema.safeParse(body ?? {});
  if (r.success) return { value: r.data };
  return { error: r.error.issues[0]?.message || 'Dados inválidos.' };
}

module.exports = { transacao, recorrente, categoriaInput, conta, cartao, pagamentoFatura, meta, aporte, contaPagar, pagarConta, transferencia, orcamento, dataISO, validar };
