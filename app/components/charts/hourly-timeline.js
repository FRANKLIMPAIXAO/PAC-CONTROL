'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = {
  productive:   '#14b8a6',
  neutral:      '#6366f1',
  unproductive: '#ef4444',
  idle:         '#f59e0b',
};

function minutes(sec) {
  return Math.round(sec / 60);
}

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + p.value, 0);
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
      padding: '8px 12px', fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}h</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, display: 'inline-block' }} />
          <span style={{ color: '#64748b', fontSize: 12 }}>{p.name}:</span>
          <strong>{minutes(p.value)} min</strong>
        </div>
      ))}
      <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px dashed #e2e8f0', fontSize: 12, color: '#64748b' }}>
        Total: {minutes(total)} min
      </div>
    </div>
  );
}

export default function HourlyTimeline({ data }) {
  if (!data?.length) {
    return <div className="muted" style={{ textAlign: 'center', padding: 40 }}>Sem dados de hoje ainda</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="hour"
          tick={{ fontSize: 12, fill: '#64748b' }}
          tickFormatter={h => `${h}h`}
          stroke="#cbd5e1"
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickFormatter={v => `${Math.round(v / 60)}m`}
          stroke="#cbd5e1"
        />
        <Tooltip content={<Tip />} cursor={{ fill: 'rgba(20, 184, 166, 0.05)' }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
        <Bar dataKey="productive"   name="Produtivo"   stackId="a" fill={COLORS.productive}   radius={[0, 0, 0, 0]} />
        <Bar dataKey="neutral"      name="Neutro"      stackId="a" fill={COLORS.neutral} />
        <Bar dataKey="unproductive" name="Improdutivo" stackId="a" fill={COLORS.unproductive} />
        <Bar dataKey="idle"         name="Ocioso"      stackId="a" fill={COLORS.idle}         radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
