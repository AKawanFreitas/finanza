// Tema da interface: 'sistema' segue o aparelho, 'claro' e 'escuro' são escolhas fixas.
// A escolha fica só neste navegador (localStorage); sem armazenamento, vale até recarregar.
const CHAVE = 'finanza.tema';
export const TEMAS = ['sistema', 'claro', 'escuro'];

const consultaEscuro = () => window.matchMedia('(prefers-color-scheme: dark)');

export function lerTema() {
  try {
    const t = localStorage.getItem(CHAVE);
    return TEMAS.includes(t) ? t : 'sistema';
  } catch {
    return 'sistema';
  }
}

export function aplicarTema(tema) {
  const escuro = tema === 'escuro' || (tema === 'sistema' && consultaEscuro().matches);
  if (escuro) document.documentElement.dataset.tema = 'escuro';
  else delete document.documentElement.dataset.tema;
}

export function salvarTema(tema) {
  try { localStorage.setItem(CHAVE, tema); } catch { /* sem armazenamento: vale só nesta sessão */ }
  aplicarTema(tema);
}

// Chamado uma vez ao abrir o app: aplica o tema e acompanha o aparelho quando a escolha é "sistema".
export function iniciarTema() {
  aplicarTema(lerTema());
  consultaEscuro().addEventListener('change', () => {
    if (lerTema() === 'sistema') aplicarTema('sistema');
  });
}
