'use client';

import { useEffect, useState, useCallback } from 'react';

function Avatar({ name, size = 40 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'];
  const color = colors[(name || '').charCodeAt(0) % colors.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontWeight: 700, fontSize: size * 0.38, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

function StatusDot({ status }) {
  const cfg = {
    active:  { color: '#10b981', label: 'Ativo' },
    idle:    { color: '#f59e0b', label: 'Ocioso' },
    offline: { color: '#6b7280', label: 'Offline' },
  }[status] || { color: '#6b7280', label: '?' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: cfg.color }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
      {cfg.label}
    </span>
  );
}

function timeAgo(ts) {
  if (!ts) return 'nunca';
  const sec = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (sec < 60) return sec + 's atras';
  if (sec < 3600) return Math.floor(sec / 60) + 'min atras';
  return Math.floor(sec / 3600) + 'h atras';
}

function UserCard({ user }) {
  const now = Date.now();
  const lastMs = user.last_ts ? new Date(user.last_ts).getTime() : 0;
  const diffSec = (now - lastMs) / 1000;
  const status = diffSec > 600 ? 'offline' : user.is_idle ? 'idle' : 'active';
  return (
    <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ position: 'relative', background: '#f1f5f9', aspectRatio: '16/9', overflow: 'hidden' }}>
        {user.screenshot_id ? (
          <img src={'/api/screenshots/' + user.screenshot_id} alt="screenshot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: 13 }}>Sem captura</div>
        )}
        <div style={{ position: 'absolute', top: 8, right: 8 }}><StatusDot status={status} /></div>
      </div>
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar name={user.name} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name || user.email}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.app_name || '—'}{user.url_domain ? ' • ' + user.url_domain : ''}</div>
          <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 2 }}>{timeAgo(user.last_ts)}</div>
        </div>
      </div>
    </div>
  );
}

export default function MosaicPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/mosaic/latest');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      setUsers(Array.isArray(data.users) ? data.users : []);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  const now = Date.now();
  const active  = users.filter(u => (now - new Date(u.last_ts).getTime()) / 1000 <= 600 && !u.is_idle).length;
  const idle    = users.filter(u => (now - new Date(u.last_ts).getTime()) / 1000 <= 600 && u.is_idle).length;
  const offline = users.filter(u => (now - new Date(u.last_ts).getTime()) / 1000 > 600).length;

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="page-header">
        <div>
          <h1 style={{ margin: 0 }}>Mosaico ao vivo</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Atualiza a cada 30 segundos{lastRefresh ? ' • ultima atualizacao: ' + lastRefresh.toLocaleTimeString('pt-BR') : ''}
          </p>
        </div>
        <button onClick={load} style={{ width: 'auto', padding: '10px 20px', background: '#0f766e' }}>Atualizar agora</button>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[{label:'Ativos',value:active,color:'#10b981'},{label:'Ociosos',value:idle,color:'#f59e0b'},{label:'Offline',value:offline,color:'#6b7280'},{label:'Total',value:users.length,color:'#6366f1'}].map(s => (
          <div key={s.label} className="card" style={{ padding: '12px 20px', minWidth: 110, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {error && <div className="card" style={{ borderLeft: '4px solid #dc2626', background: '#fef2f2', color: '#991b1b' }}>Erro: {error}</div>}

      {loading ? (
        <div className="card muted" style={{ textAlign: 'center', padding: 40 }}>Carregando...</div>
      ) : users.length === 0 ? (
        <div className="card muted" style={{ textAlign: 'center', padding: 40 }}>Nenhum colaborador com atividade recente. Verifique se o agente esta instalado.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {users.map(u => <UserCard key={u.user_id} user={u} />)}
        </div>
      )}
    </div>
  );
}
