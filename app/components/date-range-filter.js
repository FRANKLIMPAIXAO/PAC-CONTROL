'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export default function DateRangeFilter({ from, to }) {
  const router = useRouter();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);

  function apply() {
    if (f && t) router.push(`?from=${f}&to=${t}`);
  }

  function setToday() {
    const d = new Date().toISOString().slice(0, 10);
    setF(d); setT(d);
    router.push(`?from=${d}&to=${d}`);
  }

  function setDays(n) {
    const toD = new Date().toISOString().slice(0, 10);
    const frD = new Date(Date.now() - (n - 1) * 86400000).toISOString().slice(0, 10);
    setF(frD); setT(toD);
    router.push(`?from=${frD}&to=${toD}`);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <button
        onClick={setToday}
        style={{ width: 'auto', padding: '6px 12px', fontSize: 12, background: '#0f172a' }}
      >
        Hoje
      </button>
      <button
        onClick={() => setDays(7)}
        style={{ width: 'auto', padding: '6px 12px', fontSize: 12, background: '#334155' }}
      >
        7 dias
      </button>
      <button
        onClick={() => setDays(30)}
        style={{ width: 'auto', padding: '6px 12px', fontSize: 12, background: '#334155' }}
      >
        30 dias
      </button>
      <span style={{ fontSize: 12, color: '#64748b' }}>ou</span>
      <input
        type="date"
        value={f}
        onChange={e => setF(e.target.value)}
        style={{ padding: '5px 8px', fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 6, width: 'auto' }}
      />
      <span style={{ fontSize: 12, color: '#64748b' }}>até</span>
      <input
        type="date"
        value={t}
        onChange={e => setT(e.target.value)}
        style={{ padding: '5px 8px', fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 6, width: 'auto' }}
      />
      <button
        onClick={apply}
        style={{ width: 'auto', padding: '6px 14px', fontSize: 12, background: '#059669' }}
      >
        Filtrar
      </button>
    </div>
  );
}
