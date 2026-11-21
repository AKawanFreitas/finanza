const { z } = require('zod');
const { paraCentavos, paraCentavosComSinal } = require('./money');

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
  tipo: z.enum(['corrente', 'poupanca', 'carteira', 'investimento'], { error: 'Tipo de conta inválido.' }),
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

const categoriaInput = z.object({
  nome: texto('o nome da categoria', 40),
  cor: COR,
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

module.exports = { transacao, recorrente, categoriaInput, conta, transferencia, orcamento, dataISO, validar };
