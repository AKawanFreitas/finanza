import { useCallback, useState } from 'react';
import Confirmar from './Confirmar';

// Uso: const [pedirConfirmacao, dialogo] = useConfirmar();
//      pedirConfirmacao({ titulo, texto, rotulo }, () => apagar());   ...   {dialogo}
export function useConfirmar() {
  const [pedido, setPedido] = useState(null);
  const pedir = useCallback((opcoes, acao) => setPedido({ opcoes, acao }), []);
  const dialogo = pedido && (
    <Confirmar
      {...pedido.opcoes}
      onCancelar={() => setPedido(null)}
      onConfirmar={() => { const { acao } = pedido; setPedido(null); acao(); }}
    />
  );
  return [pedir, dialogo];
}
