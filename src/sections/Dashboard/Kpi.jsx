function Sparkline({ values }) {
  const max = Math.max(...values, 1);
  const step = 84 / (values.length - 1);
  const pts = values.map((v, i) => [i * step, 26 - (v / max) * 22]);
  const last = pts[pts.length - 1];
  return (
    <svg className="spark" viewBox="0 0 84 28" aria-hidden="true">
      <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill="currentColor" />
    </svg>
  );
}

// Indicador do topo do resumo. `tone="brand"` é o destaque em verde da marca.
export default function Kpi({ label, value, chip, note, spark, tone = 'plain' }) {
  return (
    <div className={`kpi kpi-${tone}`}>
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
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
