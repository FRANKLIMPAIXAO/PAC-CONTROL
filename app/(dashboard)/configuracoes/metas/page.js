'use client';

import { useState, useEffect } from 'react';

export default function MetasPage() {
  const [periods, setPeriods] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    fetch('/api/admin/goals')
      .then(r => r.json())
      .then(d => setPeriods(d.periods || []));
  }, []);

  function update(index, field, value) {
    setPeriods(prev => prev.map((p, i) =>
      i === index
        ? { ...p, [field]: (field === 'name' || field === 'description' || field === 'id') ? value : Number(value) }
        : p
    ));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periods }),
      });
      const data = await res.json();
      if (data.ok) setMsg({ type: 'ok', text: 'Metas salvas com sucesso!' });
      else setMsg({ type: 'error', text: data.error || 'Erro ao salvar.' });
    } catch {
      setMsg({ type: 'error', text: 'Erro de conexao.' });
    } finally {
      setSaving(false);
    }
  }

  const today = new Date().getDate();
  const activePeriod = periods.find(p => today >= p.dayStart && today <= p.dayEnd);

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Metas de produtividade</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          Defina metas por periodo do mes. Ideal para a rotina contabil com quinzenas distintas.
        </p>
      </div>

      {activePeriod && (
        <div className="card" style={{ borderLeft: '4px solid #0f766e', background: '#f0fdfa' }}>
          <strong style={{ color: '#0f766e' }}>Periodo ativo hoje (dia {today}): {activePeriod.name}</strong>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Meta de foco: <strong>{activePeriod.focusTarget}%</strong> &nbsp;•&nbsp;
            Minimo produtivo/dia: <strong>{activePeriod.minProductiveHoursPerDay}h</strong>
          </p>
        </div>
      )}

      {periods.map((period, i) => (
        <div key={period.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0 }}>{period.name}</h3>
              <span className="muted" style={{ fontSize: 13 }}>{period.description}</span>
            </div>
            {activePeriod?.id === period.id && (
              <span style={{
                background: '#d1fae5', color: '#065f46', fontSize: 12,
                padding: '4px 10px', borderRadius: 999, fontWeight: 600,
              }}>
                Ativo agora
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Nome do periodo
              </label>
              <input value={period.name} onChange={e => update(i, 'name', e.target.value)} style={{ width: '100%' }} />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Descricao
              </label>
              <input value={period.description || ''} onChange={e => update(i, 'description', e.target.value)} style={{ width: '100%' }} />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Dia inicio
              </label>
              <input type="number" min={1} max={31}
                value={period.dayStart}
                onChange={e => update(i, 'dayStart', e.target.value)}
                style={{ width: '100%' }} />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Dia fim
              </label>
              <input type="number" min={1} max={31}
                value={period.dayEnd}
                onChange={e => update(i, 'dayEnd', e.target.value)}
                style={{ width: '100%' }} />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Meta de foco (%)
              </label>
              <input type="number" min={0} max={100}
                value={period.focusTarget}
                onChange={e => update(i, 'focusTarget', e.target.value)}
                style={{ width: '100%' }} />
              <div style={{ marginTop: 8, height: 8, background: '#e5e7eb', borderRadius: 99 }}>
                <div style={{
                  height: '100%', borderRadius: 99, background: '#0f766e',
                  width: `${Math.min(period.focusTarget, 100)}%`, transition: 'width 0.3s',
                }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Minimo produtivo/dia (h)
              </label>
              <input type="number" min={1} max={12}
                value={period.minProductiveHoursPerDay}
                onChange={e => update(i, 'minProductiveHoursPerDay', e.target.value)}
                style={{ width: '100%' }} />
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Alerta quando colaborador fica abaixo disso
              </div>
            </div>
          </div>
        </div>
      ))}

      {msg && (
        <div className="card" style={{
          borderLeft: `4px solid ${msg.type === 'ok' ? '#059669' : '#dc2626'}`,
          background: msg.type === 'ok' ? '#f0fdfa' : '#fef2f2',
          color: msg.type === 'ok' ? '#065f46' : '#991b1b',
        }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={save} disabled={saving} style={{ width: 'auto', padding: '10px 28px', fontSize: 15 }}>
          {saving ? 'Salvando...' : 'Salvar metas'}
        </button>
      </div>
    </div>
  );
}
