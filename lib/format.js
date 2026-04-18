export function formatDuration(totalSeconds) {
  const sec = Number(totalSeconds || 0);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

export function pct(num) {
  return `${Number(num || 0).toFixed(1)}%`;
}
