import { useRef, useState } from 'react';

// Garante um envio por vez: cliques repetidos (ou Enter segurado) enquanto a requisição anterior
// não voltou são ignorados. A trava é um ref, e não só o estado, porque dois cliques no mesmo
// instante chegariam antes de o React desabilitar o botão.
// Uso: const [salvar, enviando] = useEnvioUnico(enviar);  <button onClick={salvar} disabled={enviando}>
export default function useEnvioUnico(fn) {
  const emCurso = useRef(false);
  const [enviando, setEnviando] = useState(false);

  async function executar(...args) {
    if (emCurso.current) return undefined;
    emCurso.current = true;
    setEnviando(true);
    try {
      return await fn(...args);
    } finally {
      emCurso.current = false;
      setEnviando(false);
    }
  }

  return [executar, enviando];
}
