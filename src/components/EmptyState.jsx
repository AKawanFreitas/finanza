// Estado vazio: diz o que falta e oferece a ação para resolver.
export default function EmptyState({ titulo, children, acao }) {
  return (
    <div className="empty-state">
      {titulo && <strong className="empty-titulo">{titulo}</strong>}
      {children && <p>{children}</p>}
      {acao}
    </div>
  );
}
