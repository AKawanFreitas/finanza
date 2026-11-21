const app = require('./app');
const { iniciarAgendador } = require('./lib/agendador');

const PORT = process.env.PORT || 4747;

iniciarAgendador();

app.listen(PORT, () => console.log(`Backend rodando em http://localhost:${PORT}`));
