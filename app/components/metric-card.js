export default function MetricCard({ title, value, subtitle }) {
  return (
    <div className="card">
      <div className="muted" style={{ fontSize: 13 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>{value}</div>
      {subtitle ? <div className="muted" style={{ marginTop: 4 }}>{subtitle}</div> : null}
    </div>
  );
}
