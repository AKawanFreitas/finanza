export default function MetricCard({ accent, icon, label, value, pill, pillClass }) {
  return (
    <div className={`metric-card ${accent}`}>
      <div className="metric-icon">{icon}</div>
      <div className="metric-label">{label}</div>
      <div className={`metric-value${accent === 'g' ? ' green' : accent === 'r' ? ' red' : ''}`}>
        {value}
      </div>
      <div className={`metric-pill ${pillClass}`}>{pill}</div>
    </div>
  );
}
