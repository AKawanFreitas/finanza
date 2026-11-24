// Cabeçalho padrão das páginas: ícone da seção em bloco escuro, título, subtítulo e ações à direita.
export default function PageHeader({ Icon, titulo, subtitulo, children }) {
  return (
    <header className="page-bar hero">
      <div className="greeting">
        {Icon && <span className="greeting-icon" aria-hidden="true"><Icon size={28} strokeWidth={2.4} /></span>}
        <div>
          <h1 className="page-title">{titulo}</h1>
          {subtitulo && <p className="page-subtitle">{subtitulo}</p>}
        </div>
      </div>
      {children}
    </header>
  );
}
