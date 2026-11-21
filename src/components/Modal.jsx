import { useEffect, useRef } from 'react';

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Diálogo acessível: prende o foco, fecha com Esc ou clique fora, trava a rolagem do fundo
// e devolve o foco a quem abriu. `variante="folha"` vira uma folha presa à base no celular.
export default function Modal({ titulo, tituloId, onFechar, variante = 'centro', children }) {
  const caixa = useRef(null);
  const aoFechar = useRef(onFechar);
  aoFechar.current = onFechar;

  useEffect(() => {
    const anterior = document.activeElement;
    const el = caixa.current;
    const primeiro = el.querySelector('[data-foco-inicial]') ?? el.querySelector(FOCAVEIS);
    primeiro?.focus();

    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function teclado(e) {
      if (e.key === 'Escape') { e.stopPropagation(); aoFechar.current(); return; }
      if (e.key !== 'Tab') return;
      const itens = [...el.querySelectorAll(FOCAVEIS)];
      if (!itens.length) return;
      const ini = itens[0], fim = itens[itens.length - 1];
      if (e.shiftKey && document.activeElement === ini) { e.preventDefault(); fim.focus(); }
      else if (!e.shiftKey && document.activeElement === fim) { e.preventDefault(); ini.focus(); }
    }
    document.addEventListener('keydown', teclado);
    return () => {
      document.removeEventListener('keydown', teclado);
      document.body.style.overflow = overflow;
      anterior?.focus?.();
    };
  }, []);

  return (
    <div className={`modal-fundo modal-${variante}`} onMouseDown={e => e.target === e.currentTarget && onFechar()}>
      <div className="modal" ref={caixa} role="dialog" aria-modal="true" aria-labelledby={tituloId}>
        {titulo && <h2 id={tituloId}>{titulo}</h2>}
        {children}
      </div>
    </div>
  );
}
