// Barra de progresso do orçamento; passa de 100% sem transbordar.
export default function BarraOrcamento({ item }) {
  const largura = Math.min(100, item.percentual);
  return (
    <div className="orc-trilho" role="img" aria-label={`${item.percentual}% do limite de ${item.cat}`}>
      <div className={`orc-barra ${item.status}`} style={{ width: `${largura}%` }} />
    </div>
  );
}
