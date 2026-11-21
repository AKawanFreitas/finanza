import { useEffect } from 'react';

// Compra parcelada: pergunta o que excluir. Esc ou clicar fora cancela.
export default function ExcluirParcelas({ lancamento, onEscolher, onCancelar }) {
  useEffect(() => {
    const fechar = e => e.key === 'Escape' && onCancelar();
    document.addEventListener('keydown', fechar);
    return () => document.removeEventListener('keydown', fechar);
  }, [onCancelar]);

  const { numero, total } = lancamento.parcela;
  return (
    <div className="modal-fundo" onMouseDown={e => e.target === e.currentTarget && onCancelar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-excluir">
        <h2 id="titulo-excluir">Excluir compra parcelada</h2>
        <p>“{lancamento.desc}” é a parcela {numero} de {total}. O que você quer excluir?</p>
        <div className="modal-acoes">
          <button className="btn" onClick={() => onEscolher(undefined)}>Só esta parcela</button>
          {numero < total && <button className="btn" onClick={() => onEscolher('futuras')}>Esta e as próximas ({total - numero + 1})</button>}
          <button className="btn btn-perigo" onClick={() => onEscolher('todas')}>Todas as {total} parcelas</button>
          <button className="btn btn-ghost" onClick={onCancelar}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
