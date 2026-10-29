'use client';

/* Gauge circular estilo velocímetro WorkMonitor */
export default function ProductivityGauge({ value = 0, size = 180 }) {
  const pct   = Math.min(100, Math.max(0, Math.round(value)));
  const cx    = size / 2;
  const cy    = size / 2 + size * 0.06;
  const r     = size * 0.38;
  const stroke= size * 0.09;

  /* arco: vai de 210° a -30° (240° total) */
  const startAngle = 210;
  const endAngle   = -30;
  const totalArc   = 240;
  const fillArc    = (pct / 100) * totalArc;

  function polarToXY(angleDeg, radius) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  function arc(startDeg, endDeg, radius) {
    const s   = polarToXY(startDeg, radius);
    const e   = polarToXY(endDeg,   radius);
    const big = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
    const dir = endDeg > startDeg ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${big} ${dir} ${e.x} ${e.y}`;
  }

  /* cor do fill */
  const fillColor = pct >= 70 ? '#059669' : pct >= 50 ? '#d97706' : '#dc2626';

  /* ticks */
  const ticks = [0, 25, 50, 75, 100].map(v => {
    const a = startAngle - (v / 100) * totalArc;
    const inner = polarToXY(a, r - stroke / 2 - size * 0.04);
    const outer = polarToXY(a, r + stroke / 2 + size * 0.01);
    return { inner, outer, v };
  });

  const needleAngle = startAngle - fillArc;
  const needleTip   = polarToXY(needleAngle, r * 0.82);
  const needleBase1 = polarToXY(needleAngle + 90, size * 0.035);
  const needleBase2 = polarToXY(needleAngle - 90, size * 0.035);

  const fs = size * 0.19;

  return (
    <svg width={size} height={size * 0.82} viewBox={`0 0 ${size} ${size * 0.82}`}>
      {/* trilha */}
      <path
        d={arc(startAngle, endAngle, r)}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      {/* fill colorido */}
      {pct > 0 && (
        <path
          d={arc(startAngle, startAngle - fillArc, r)}
          fill="none"
          stroke={fillColor}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      )}
      {/* ticks */}
      {ticks.map(t => (
        <line
          key={t.v}
          x1={t.inner.x} y1={t.inner.y}
          x2={t.outer.x} y2={t.outer.y}
          stroke="#d1d5db" strokeWidth={size * 0.012}
          strokeLinecap="round"
        />
      ))}
      {/* agulha */}
      <polygon
        points={`${needleTip.x},${needleTip.y} ${needleBase1.x},${needleBase1.y} ${needleBase2.x},${needleBase2.y}`}
        fill={fillColor}
        opacity={0.9}
      />
      <circle cx={cx} cy={cy} r={size * 0.045} fill={fillColor} />
      <circle cx={cx} cy={cy} r={size * 0.022} fill="#fff" />
      {/* valor */}
      <text
        x={cx} y={cy - size * 0.06}
        textAnchor="middle"
        fontSize={fs}
        fontWeight="800"
        fill={fillColor}
        fontFamily="Inter, sans-serif"
      >
        {pct}%
      </text>
      <text
        x={cx} y={cy + size * 0.08}
        textAnchor="middle"
        fontSize={size * 0.07}
        fill="#6b7280"
        fontFamily="Inter, sans-serif"
      >
        Índice de foco
      </text>
      {/* labels */}
      <text x={polarToXY(startAngle + 4, r + size * 0.14).x} y={polarToXY(startAngle + 4, r + size * 0.14).y}
        textAnchor="middle" fontSize={size * 0.065} fill="#9ca3af" fontFamily="Inter, sans-serif">0%</text>
      <text x={polarToXY(endAngle - 4, r + size * 0.14).x} y={polarToXY(endAngle - 4, r + size * 0.14).y}
        textAnchor="middle" fontSize={size * 0.065} fill="#9ca3af" fontFamily="Inter, sans-serif">100%</text>
    </svg>
  );
}
