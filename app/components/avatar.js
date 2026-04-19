const PALETTE = [
  '#0f766e', '#6366f1', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316',
];

function colorFromName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({ name, size = 34 }) {
  const bg = colorFromName(name || '');
  return (
    <div
      className="avatar"
      style={{
        width: size, height: size, background: bg, fontSize: Math.round(size * 0.42),
      }}
      title={name}
    >
      {initials(name)}
    </div>
  );
}
