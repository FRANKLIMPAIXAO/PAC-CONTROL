// Metric KPI Card — v2
const ACCENTS = {
  brand:   { bg: '#eff6ff', fg: '#1e40af', bar: 'linear-gradient(90deg,#1e40af,#3b82f6)' },
  success: { bg: '#ecfdf5', fg: '#059669', bar: 'linear-gradient(90deg,#059669,#10b981)' },
  warning: { bg: '#fffbeb', fg: '#d97706', bar: 'linear-gradient(90deg,#d97706,#f59e0b)' },
  danger:  { bg: '#fef2f2', fg: '#dc2626', bar: 'linear-gradient(90deg,#dc2626,#ef4444)' },
  info:    { bg: '#f0f9ff', fg: '#0ea5e9', bar: 'linear-gradient(90deg,#0ea5e9,#38bdf8)' },
  purple:  { bg: '#f5f3ff', fg: '#7c3aed', bar: 'linear-gradient(90deg,#7c3aed,#a78bfa)' },
};

export default function MetricCard({ title, value, subtitle, icon, accent = 'brand', trend }) {
  const c = ACCENTS[accent] || ACCENTS.brand;
  return (
    <div className="kpi" style={{ '--kpi-bar': c.bar }}>
      {icon && (
        <div className="kpi-icon" style={{ background: c.bg, color: c.fg }}>
          {icon}
        </div>
      )}
      <div className="kpi-label">{title}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-sub">
        {subtitle && <span>{subtitle}</span>}
        {trend && (
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: trend.dir === 'up' ? '#059669' : '#dc2626',
            background: trend.dir === 'up' ? '#dcfce7' : '#fee2e2',
            padding: '2px 8px',
            borderRadius: 999,
          }}>
            {trend.dir === 'up' ? '▲' : '▼'} {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}
