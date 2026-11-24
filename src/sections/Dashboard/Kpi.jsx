// Linha com área suave sob ela. Normaliza entre o menor e o maior valor, inclusive negativos.
function Sparkline({ values }) {
  const W = 120, H = 44;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const step = W / Math.max(values.length - 1, 1);
  const pts = values.map((v, i) => [i * step, H - 6 - ((v - min) / span) * (H - 14)]);
  const linha = pts.map(p => p.join(',')).join(' ');
  const last = pts[pts.length - 1];
  const id = `g${Math.round(Math.random() * 1e6)}`;
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity=".28" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${H} ${linha} ${W},${H}`} fill={`url(#${id})`} />
      <polyline points={linha} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="3" fill="currentColor" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Indicador do topo do resumo. `tone="brand"` é o destaque escuro da marca.
// `kind` colore o ícone: in (verde), out (vermelho) ou fix (azul).
export default function Kpi({ label, value, chip, note, spark, Icon, kind = 'in', tone = 'plain' }) {
  return (
    <div className={`kpi kpi-${tone} kpi-${kind}`}>
      <div className="kpi-top">
        <span className="kpi-id">
          {Icon && <span className={`kpi-icon ${kind}`}><Icon size={20} strokeWidth={2.2} /></span>}
          <span className="kpi-label">{label}</span>
        </span>
        {chip && <span className={`chip ${chip.cls}`}>{chip.text}</span>}
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-bottom">
        <span className="kpi-note">{note}</span>
        {spark && <Sparkline values={spark} />}
      </div>
    </div>
  );
}
