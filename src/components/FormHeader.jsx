// Cabeçalho dos formulários: bloco de ícone, título e subtítulo.
export default function FormHeader({ Icon, titulo, subtitulo }) {
  return (
    <div className="form-header">
      {Icon && <span className="form-header-icon" aria-hidden="true"><Icon size={26} strokeWidth={2} /></span>}
      <div className="form-header-text">
        <div className="form-header-title">{titulo}</div>
        {subtitulo && <div className="form-header-sub">{subtitulo}</div>}
      </div>
    </div>
  );
}
