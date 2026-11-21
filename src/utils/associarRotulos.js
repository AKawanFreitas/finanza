// Liga cada <label class="form-label"> ao campo do mesmo .form-group (htmlFor/id), para que
// leitores de tela anunciem o nome do campo e tocar no rótulo foque o campo.
// Roda uma vez por mudança no DOM; rótulos que já têm htmlFor são respeitados.
let contador = 0;

function associar(raiz) {
  raiz.querySelectorAll?.('.form-group > label:not([for]), .form-group > .form-label:not([for])').forEach(rotulo => {
    if (rotulo.tagName !== 'LABEL') return;
    const campo = rotulo.parentElement.querySelector('input, select, textarea, .cselect-trigger');
    if (!campo) return;
    if (!campo.id) campo.id = `campo-${++contador}`;
    rotulo.htmlFor = campo.id;
  });
}

export function iniciarAssociacaoDeRotulos() {
  associar(document);
  let agendado = false;
  new MutationObserver(() => {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(() => { agendado = false; associar(document); });
  }).observe(document.body, { childList: true, subtree: true });
}
