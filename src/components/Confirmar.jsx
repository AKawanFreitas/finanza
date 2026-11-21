import Modal from './Modal';

// Confirmação de ação destrutiva. O foco inicial cai em "Cancelar" para que um Enter distraído não apague nada.
export default function Confirmar({ titulo, texto, rotulo = 'Excluir', onConfirmar, onCancelar }) {
  return (
    <Modal titulo={titulo} tituloId="titulo-confirmar" variante="folha" onFechar={onCancelar}>
      {texto && <p>{texto}</p>}
      <div className="modal-acoes">
        <button className="btn btn-perigo" onClick={onConfirmar}>{rotulo}</button>
        <button className="btn btn-ghost" data-foco-inicial onClick={onCancelar}>Cancelar</button>
      </div>
    </Modal>
  );
}
