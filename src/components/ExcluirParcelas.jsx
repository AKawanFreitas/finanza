import Modal from './Modal';

// Compra parcelada: pergunta o que excluir. Esc ou clicar fora cancela.
export default function ExcluirParcelas({ lancamento, onEscolher, onCancelar }) {
  const { numero, total } = lancamento.parcela;
  return (
    <Modal titulo="Excluir compra parcelada" onFechar={onCancelar}>
      <p>“{lancamento.desc}” é a parcela {numero} de {total}. O que você quer excluir?</p>
      <div className="modal-acoes">
        <button className="btn" onClick={() => onEscolher(undefined)}>Só esta parcela</button>
        {numero < total && <button className="btn" onClick={() => onEscolher('futuras')}>Esta e as próximas ({total - numero + 1})</button>}
        <button className="btn btn-perigo" onClick={() => onEscolher('todas')}>Todas as {total} parcelas</button>
        <button className="btn btn-ghost" onClick={onCancelar}>Cancelar</button>
      </div>
    </Modal>
  );
}
