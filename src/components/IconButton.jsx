// Botão só com ícone. `label` é obrigatório: vira o nome acessível e a dica ao passar o mouse.
export default function IconButton({ label, children, danger = false, className = '', ...rest }) {
  return (
    <button type="button" className={`icon-btn${danger ? ' danger' : ''} ${className}`.trim()} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}
