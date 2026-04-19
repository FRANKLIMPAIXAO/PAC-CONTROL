'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

function colorFor(focus, target) {
  if (focus >= target)        return '#059669';
  if (focus >= target * 0.85) return '#d97706';
  return '#dc2626';
}

function Tip({ active, payload, target }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
      padding: '8px 12px', fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    }}>
      <div style={{ fontWeight: 600 }}>{d.name}</div>
      <div>Foco: <strong>{d.focus.toFixed(1)}%</strong></div>
      <div className="muted" style={{ fontSize: 12 }}>Meta: {target}%</div>
    </div>
  );
}

export default function FocusRanking({ rows, target }) {
  if (!rows?.length) {
    return <div className="muted" style={{ textAlign: 'center', padding: 40 }}>Sem dados suficientes</div>;
  }

  // Limita a 10 pra manter legibilidade
  const data = rows.slice(0, 10).map(r => ({
    name: r.name,
    focus: Number(r.focus.toFixed(1)),
  }));

  const height = Math.max(250, data.length * 40);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 20, left: 4, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fontSize: 12, fill: '#64748b' }}
          stroke="#cbd5e1"
          unit="%"
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: '#0f172a' }}
          stroke="#cbd5e1"
          width={120}
        />
        <Tooltip content={<Tip target={target} />} cursor={{ fill: 'rgba(20, 184, 166, 0.06)' }} />
        <ReferenceLine x={target} stroke="#0f766e" strokeDasharray="4 4" label={{ value: `Meta ${target}%`, position: 'top', fill: '#0f766e', fontSize: 11 }} />
        <Bar dataKey="focus" radius={[0, 6, 6, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={colorFor(entry.focus, target)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
