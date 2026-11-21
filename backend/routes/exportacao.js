const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { exigirLogin } = require('../lib/auth');
const { paraReais }   = require('../lib/money');
const { SELECT, filtros } = require('../lib/transacoes');

router.use(exigirLogin);

const MAX_LINHAS = 50_000;
const CABECALHO = ['Data', 'Descrição', 'Tipo', 'Categoria', 'Conta', 'Valor', 'Observação'];

// Células de texto que começam com = + - @ viram fórmula quando o CSV abre no Excel ou Sheets.
// Um apóstrofo na frente faz o programa tratá-las como texto.
const seguro = s => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);

const celulaCsv = v => {
  const s = String(v);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const decimalBR = v => v.toFixed(2).replace('.', ',');
const dataBR = iso => iso.split('-').reverse().join('/');

function carregar(req) {
  const f = filtros(req.query, req.user.id);
  if (f.error) return { error: f.error };
  const linhas = db.prepare(`${SELECT} WHERE ${f.where} ORDER BY t.data DESC, t.id DESC LIMIT ?`).all(...f.args, MAX_LINHAS + 1);
  if (linhas.length > MAX_LINHAS) return { error: `Há mais de ${MAX_LINHAS} lançamentos neste filtro. Use um mês ou outros filtros para exportar.` };
  return { linhas };
}

const nomeArquivo = (req, ext) => `lancamentos${req.query.mes ? `-${req.query.mes}` : ''}.${ext}`;

// GET /api/exportacao/lancamentos?formato=csv|xlsx  (aceita os mesmos filtros da listagem)
router.get('/lancamentos', async (req, res, next) => {
  try {
    const formato = req.query.formato ?? 'csv';
    if (formato !== 'csv' && formato !== 'xlsx') return res.status(400).json({ error: 'O formato deve ser "csv" ou "xlsx".' });
    const { linhas, error } = carregar(req);
    if (error) return res.status(400).json({ error });

    if (formato === 'csv') {
      // BOM + ";" + vírgula decimal: abre direto, com acentos e números certos, no Excel em português.
      const corpo = [CABECALHO, ...linhas.map(r => [
        dataBR(r.data), seguro(r.descricao), r.tipo === 'entrada' ? 'Entrada' : 'Saída',
        seguro(r.cat), seguro(r.conta), decimalBR(paraReais(r.valor_centavos)), seguro(r.obs),
      ])].map(l => l.map(celulaCsv).join(';')).join('\r\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo(req, 'csv')}"`);
      return res.send(`﻿${corpo}\r\n`);
    }

    // Pacote só em ESM: import() dinâmico funciona a partir do CommonJS em qualquer Node suportado.
    const { default: escreverXlsx } = await import('write-excel-file/node');
    const negrito = texto => ({ value: texto, fontWeight: 'bold' });

    const abaLancamentos = [
      CABECALHO.map(negrito),
      ...linhas.map(r => {
        const [a, m, d] = r.data.split('-').map(Number);
        return [
          { value: new Date(Date.UTC(a, m - 1, d)), type: Date, format: 'dd/mm/yyyy' },
          { value: r.descricao, type: String },
          { value: r.tipo === 'entrada' ? 'Entrada' : 'Saída', type: String },
          { value: r.cat, type: String },
          { value: r.conta, type: String },
          { value: paraReais(r.valor_centavos), type: Number, format: '#,##0.00' },
          { value: r.obs || null, type: String },
        ];
      }),
    ];

    const porCategoria = new Map();
    for (const r of linhas) {
      const acc = porCategoria.get(r.cat) ?? { entradas: 0, saidas: 0 };
      acc[r.tipo === 'entrada' ? 'entradas' : 'saidas'] += r.valor_centavos;
      porCategoria.set(r.cat, acc);
    }
    const abaCategorias = [
      ['Categoria', 'Entradas', 'Saídas'].map(negrito),
      ...[...porCategoria].sort((a, b) => b[1].saidas - a[1].saidas).map(([cat, v]) => [
        { value: cat, type: String },
        { value: paraReais(v.entradas), type: Number, format: '#,##0.00' },
        { value: paraReais(v.saidas), type: Number, format: '#,##0.00' },
      ]),
    ];

    const buffer = await escreverXlsx([
      { data: abaLancamentos, sheet: 'Lançamentos', columns: [{ width: 12 }, { width: 38 }, { width: 10 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 30 }] },
      { data: abaCategorias, sheet: 'Por categoria', columns: [{ width: 22 }, { width: 14 }, { width: 14 }] },
    ]).toBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo(req, 'xlsx')}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
