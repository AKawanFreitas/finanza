import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
let abertos = 0;

// Diálogo modal: prende o foco, fecha com Esc ou clique no fundo, devolve o foco a quem o abriu
// e deixa o resto da página inerte (inclusive para leitores de tela) enquanto está aberto.
export default function Modal({ titulo, onFechar, children }) {
  const id = useId();
  const caixa = useRef(null);
  const fechar = useRef(onFechar);
  fechar.current = onFechar;

  useEffect(() => {
    const anterior = document.activeElement;
    const raiz = document.getElementById('root');
    abertos++;
    raiz?.setAttribute('inert', '');
    const foco = caixa.current.querySelector('[data-autofocus]') ?? caixa.current.querySelector(FOCAVEIS) ?? caixa.current;
    foco.focus();

    const teclas = e => {
      if (e.key === 'Escape') { e.preventDefault(); fechar.current(); return; }
      if (e.key !== 'Tab') return;
      const itens = [...caixa.current.querySelectorAll(FOCAVEIS)];
      if (!itens.length) { e.preventDefault(); return; }
      const [primeiro, ultimo] = [itens[0], itens[itens.length - 1]];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener('keydown', teclas);
    return () => {
      document.removeEventListener('keydown', teclas);
      if (--abertos === 0) raiz?.removeAttribute('inert');
      if (anterior instanceof HTMLElement && document.contains(anterior)) anterior.focus();
    };
  }, []);

  return createPortal(
    // O fundo só fecha com o mouse; o teclado fecha com Esc (tratado acima).
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className="modal-fundo" onMouseDown={e => e.target === e.currentTarget && onFechar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={`${id}-titulo`} tabIndex={-1} ref={caixa}>
        <h2 id={`${id}-titulo`}>{titulo}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
