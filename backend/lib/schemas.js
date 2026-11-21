const { z } = require('zod');
const { paraCentavos } = require('./money');

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
  obs,
  ...categoria,
}).refine(exigeCategoria, msgCategoria);

const categoriaInput = z.object({
  nome: texto('o nome da categoria', 40),
  cor: z.string({ error: 'A cor deve estar no formato #RRGGBB.' }).regex(/^#[0-9a-fA-F]{6}$/, 'A cor deve estar no formato #RRGGBB.'),
});

// Devolve { value } ou { error } com a primeira mensagem, no formato que as rotas já usavam.
function validar(schema, body) {
  const r = schema.safeParse(body ?? {});
  if (r.success) return { value: r.data };
  return { error: r.error.issues[0]?.message || 'Dados inválidos.' };
}

module.exports = { transacao, recorrente, categoriaInput, validar };
