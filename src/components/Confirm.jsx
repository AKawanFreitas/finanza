import { createContext, useCallback, useContext, useRef, useState } from 'react';
import Modal from './Modal';

const ConfirmContext = createContext(null);

// Uso:  const confirmar = useConfirm();
//       if (!await confirmar({ titulo: 'Excluir conta', mensagem: '...', rotulo: 'Excluir conta' })) return;
// `rotulo` é o verbo do botão (o mesmo do aviso depois: "Excluir" → "Excluído"). `perigo` pinta o botão de vermelho.
export function ConfirmProvider({ children }) {
  const [pedido, setPedido] = useState(null);
  const resolver = useRef(null);

  const confirmar = useCallback(opcoes => new Promise(resolve => {
    resolver.current = resolve;
    setPedido({ perigo: true, ...opcoes });
  }), []);

  const responder = resposta => {
    resolver.current?.(resposta);
    resolver.current = null;
    setPedido(null);
  };

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      {pedido && (
        <Modal titulo={pedido.titulo} onFechar={() => responder(false)}>
          {pedido.mensagem && <p>{pedido.mensagem}</p>}
          <div className="modal-acoes">
            <button className={`btn ${pedido.perigo ? 'btn-perigo' : 'btn-primary'}`} onClick={() => responder(true)}>
              {pedido.rotulo ?? 'Confirmar'}
            </button>
            {/* O foco inicial cai no "Cancelar": Enter sem querer não apaga nada. */}
            <button className="btn btn-ghost" data-autofocus onClick={() => responder(false)}>Cancelar</button>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  return useContext(ConfirmContext);
}
