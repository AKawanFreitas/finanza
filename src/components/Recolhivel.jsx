import { useEffect, useRef, useState } from 'react';
import { Plus, ChevronUp } from 'lucide-react';

// No computador o formulário fica sempre à vista. No celular ele recolhe atrás de um botão,
// para a lista aparecer primeiro; `forcarAberto` (ex.: editando um item) abre e, ao terminar, recolhe.
export default function Recolhivel({ rotulo, forcarAberto = false, children }) {
  const [aberto, setAberto] = useState(false);
  const estavaForcado = useRef(forcarAberto);

  useEffect(() => {
    if (estavaForcado.current && !forcarAberto) setAberto(false);
    estavaForcado.current = forcarAberto;
  }, [forcarAberto]);

  const visivel = aberto || forcarAberto;
  return (
    <div className={`recolhivel${visivel ? ' aberto' : ''}`}>
      <button
        type="button" className="btn btn-primary recolhivel-botao" hidden={forcarAberto}
        aria-expanded={visivel} onClick={() => setAberto(a => !a)}
      >
        {visivel ? <ChevronUp size={16} strokeWidth={2.5} /> : <Plus size={16} strokeWidth={2.5} />}
        {visivel ? 'Fechar formulário' : rotulo}
      </button>
      <div className="recolhivel-corpo">{children}</div>
    </div>
  );
}
