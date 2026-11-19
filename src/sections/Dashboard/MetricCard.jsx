export default function MetricCard({ accent, icon: Icon, label, value, pill, pillClass }) {
  return (
    <div className={`metric-card ${accent}`}>
      <div className="metric-top">
        <div className="metric-icon">
          <Icon size={20} strokeWidth={2} />
        </div>
        <span className={`metric-pill ${pillClass}`}>{pill}</span>
      </div>
      <div className="metric-label">{label}</div>
      <div className={`metric-value${accent === 'g' ? ' green' : accent === 'r' ? ' red' : ''}`}>
        {value}
      </div>
    </div>
  );
}
