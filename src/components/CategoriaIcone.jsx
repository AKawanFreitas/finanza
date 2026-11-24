import { iconeDaChave } from '../utils/iconesCategoria';

// Ícone da categoria num bloco com a cor dela. `tam` é o lado do bloco em px.
export default function CategoriaIcone({ icone, cor, tam = 36 }) {
  const Icone = iconeDaChave(icone);
  return (
    <span className="cat-icone" style={{ '--cor': cor, width: tam, height: tam }} aria-hidden="true">
      <Icone size={Math.round(tam * 0.5)} strokeWidth={2.2} />
    </span>
  );
}
