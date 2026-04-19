// Reusable KPI card with icon + optional trend.
// Props:
//   title     string   - label acima do valor
//   value     string   - numero principal
//   subtitle  string?  - texto descritivo pequeno
//   icon      string?  - emoji ou caractere exibido no quadrado colorido
//   accent    string?  - uma de: 'brand' | 'success' | 'warning' | 'danger' | 'info'
//   trend     { dir: 'up' | 'down', value: string }?  - opcional, indicador

const ACCENTS = {
  brand:   { bg: '#f0fdfa', fg: '#0f766e', bar: '#14b8a6' },
  success: { bg: '#d1fae5', fg: '#059669', bar: '#10b981' },
  warning: { bg: '#fef3c7', fg: '#d97706', bar: '#f59e0b' },
  danger:  { bg: '#fee2e2', fg: '#dc2626', bar: '#ef4444' },
  info:    { bg: '#dbeafe', fg: '#2563eb', bar: '#3b82f6' },
};

export default function MetricCard({ title, value, subtitle, icon, accent = 'brand', trend }) {
  const c = ACCENTS[accent] || ACCENTS.brand;
  return (
    <div className="kpi">
      {icon && (
        <div className="kpi-icon" style={{ background: c.bg, color: c.fg }}>
          {icon}
        </div>
      )}
      <div className="kpi-label">{title}</div>
      <div className="kpi-value">{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
        {subtitle && <span className="kpi-sub">{subtitle}</span>}
        {trend && (
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            color: trend.dir === 'up' ? '#059669' : '#dc2626',
            background: trend.dir === 'up' ? '#d1fae5' : '#fee2e2',
            padding: '2px 8px',
            borderRadius: 999,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
          }}>
            {trend.dir === 'up' ? '▲' : '▼'} {trend.value}
          </span>
        )}
      </div>
      <div style={{
        position: 'absolute',
        left: 0, top: 0, bottom: 0,
        width: 3,
        background: c.bar,
        borderTopLeftRadius: 'var(--radius-md)',
        borderBottomLeftRadius: 'var(--radius-md)',
      }} />
    </div>
  );
}
