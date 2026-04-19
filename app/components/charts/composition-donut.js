'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = {
  productive:   '#14b8a6', // teal
  neutral:      '#6366f1', // indigo
  unproductive: '#ef4444', // red
  idle:         '#f59e0b', // amber
};

const LABELS = {
  productive:   'Produtivo',
  neutral:      'Neutro',
  unproductive: 'Improdutivo',
  idle:         'Ocioso',
};

function formatHours(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
      padding: '8px 12px', fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    }}>
      <div style={{ fontWeight: 600, color: item.payload.fill }}>{item.name}</div>
      <div style={{ color: '#0f172a' }}>{formatHours(item.value)} <span style={{ color: '#64748b' }}>({item.payload.pct}%)</span></div>
    </div>
  );
}

export default function CompositionDonut({ productive, neutral, unproductive, idle }) {
  const total = productive + neutral + unproductive + idle;
  if (total === 0) {
    return <div className="muted" style={{ textAlign: 'center', padding: 40 }}>Sem dados suficientes</div>;
  }

  const data = [
    { key: 'productive',   name: LABELS.productive,   value: productive,   pct: ((productive   / total) * 100).toFixed(0) },
    { key: 'neutral',      name: LABELS.neutral,      value: neutral,      pct: ((neutral      / total) * 100).toFixed(0) },
    { key: 'unproductive', name: LABELS.unproductive, value: unproductive, pct: ((unproductive / total) * 100).toFixed(0) },
    { key: 'idle',         name: LABELS.idle,         value: idle,         pct: ((idle         / total) * 100).toFixed(0) },
  ].filter(d => d.value > 0);

  const productivePct = total > 0 ? Math.round((productive / total) * 100) : 0;

  return (
    <div style={{ position: 'relative', width: '100%', height: 280 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={110}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map(entry => (
              <Cell key={entry.key} fill={COLORS[entry.key]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            wrapperStyle={{ fontSize: 13, paddingTop: 10 }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Centro do donut */}
      <div style={{
        position: 'absolute',
        top: 'calc(50% - 30px)',
        left: 0, right: 0,
        textAlign: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
          Foco
        </div>
        <div style={{ fontSize: 30, fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>
          {productivePct}%
        </div>
      </div>
    </div>
  );
}
