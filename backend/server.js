const app = require('./app');
const { limparExpiradas } = require('./lib/auth');

const PORT = process.env.PORT || 4747;

limparExpiradas();
setInterval(limparExpiradas, 6 * 60 * 60e3).unref();

app.listen(PORT, () => console.log(`Backend rodando em http://localhost:${PORT}`));
