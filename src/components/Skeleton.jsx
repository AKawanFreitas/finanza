// Bloco de carregamento. Use no lugar de "Carregando..." ou de uma tela em branco.
export function Skeleton({ width = '100%', height = 16, style }) {
  return <span className="skeleton" aria-hidden="true" style={{ width, height, ...style }} />;
}

// Esqueleto de uma lista de linhas, com texto só para leitor de tela.
export function SkeletonLista({ linhas = 5 }) {
  return (
    <div className="skeleton-lista" role="status">
      <span className="sr-only">Carregando…</span>
      {Array.from({ length: linhas }, (_, i) => <Skeleton key={i} height={18} width={`${92 - (i % 3) * 14}%`} />)}
    </div>
  );
}
