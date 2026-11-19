const express      = require('express');
const cors         = require('cors');
const transactions = require('./routes/transactions');
const recorrentes  = require('./routes/recorrentes');
const categorias   = require('./routes/categorias');

const app  = express();
const PORT = process.env.PORT || 4747;

app.use(cors());
app.use(express.json());

app.use('/api/transactions', transactions);
app.use('/api/recorrentes',  recorrentes);
app.use('/api/categorias',   categorias);

app.listen(PORT, () => console.log(`Backend rodando em http://localhost:${PORT}`));
