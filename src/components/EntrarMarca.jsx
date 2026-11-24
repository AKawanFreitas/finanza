// Painel verde da esquerda nas telas de entrada: marca, frase de apresentação e ilustração.
export default function EntrarMarca({ subtitulo = 'Acompanhe entradas, gastos e contas fixas do mês em um lugar só.' }) {
  return (
    <section className="entrar-marca">
      <div className="entrar-marca-topo">
        <img src="/logo sem texto - finanza.png" alt="" className="entrar-logo" />
        <span className="entrar-nome">Finanza</span>
      </div>
      <div className="entrar-marca-texto">
        <h1>Assuma o controle<br />das suas <em>finanças</em></h1>
        <span className="entrar-traco" aria-hidden="true" />
        <p>{subtitulo}</p>
      </div>
      <img src="/login-ilustracao-sem-fundo.webp" alt="" className="entrar-ilustracao" />
    </section>
  );
}
