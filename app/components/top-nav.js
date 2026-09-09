'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

const NAV_LINKS = [
  { href: '/dashboard',     label: 'Painel',        roles: null },
  { href: '/reports',       label: 'Analises',      roles: ['admin','manager'] },
  { href: '/mosaic',        label: 'Mosaico',       roles: ['admin'] },
  { href: '/alertas',       label: 'Alertas',       roles: ['admin'] },
  { href: '/configuracoes', label: 'Configuracoes', roles: ['admin'] },
  { href: '/perfil',        label: 'Meu perfil',    roles: null },
];

// Iniciais coloridas por nome
function hashColor(name = '') {
  const colors = ['#1e40af','#059669','#7c3aed','#d97706','#dc2626','#0ea5e9','#db2777','#065f46'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return colors[h % colors.length];
}

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export default function TopNav({ user }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [syncing,  setSyncing]  = useState(false);
  const [syncMsg,  setSyncMsg]  = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const color = hashColor(user.name);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  async function syncToday() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res  = await fetch('/api/admin/sync-today', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setSyncMsg({ type: 'ok', text: `Sincronizado! ${data.users_processed} colaborador(es).` });
        setTimeout(() => { setSyncMsg(null); router.refresh(); }, 2500);
      } else {
        setSyncMsg({ type: 'err', text: data.error || 'Erro ao sincronizar' });
        setTimeout(() => setSyncMsg(null), 4000);
      }
    } catch {
      setSyncMsg({ type: 'err', text: 'Erro de conexao' });
      setTimeout(() => setSyncMsg(null), 4000);
    } finally {
      setSyncing(false);
    }
  }

  const visibleLinks = NAV_LINKS.filter(l => !l.roles || l.roles.includes(user.role));

  return (
    <>
      <div className="topnav card">
        {/* Logo + brand */}
        <div className="topnav-brand">
          <div className="topnav-brand-logo">PC</div>
          <div className="topnav-brand-text">
            <div className="topnav-brand-name">PAC CONTROL</div>
            <div className="topnav-brand-sub">{user.name} &bull; {user.email}</div>
          </div>
        </div>

        {/* Nav links */}
        <nav>
          {visibleLinks.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={pathname.startsWith(l.href) ? 'active-link' : ''}
            >
              {l.label}
            </Link>
          ))}

          {/* PAC.IA destacado */}
          {user.role === 'admin' && (
            <Link href="/pac-ia" style={{
              padding: '7px 14px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              background: pathname === '/pac-ia'
                ? 'linear-gradient(135deg,#1e40af,#3b82f6)'
                : 'linear-gradient(135deg,#1e40af,#3b82f6)',
              color: 'white',
              opacity: pathname === '/pac-ia' ? 1 : 0.88,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}>
              &#10024; PAC.IA
            </Link>
          )}

          <div className="nav-sep" />

          {/* Sincronizar */}
          {user.role === 'admin' && (
            <button
              className="btn ghost sm"
              onClick={syncToday}
              disabled={syncing}
              title="Recalcular metricas do dia agora"
            >
              {syncing ? '⏳' : '🔄'} {syncing ? 'Aguarde...' : 'Sincronizar'}
            </button>
          )}

          {/* Avatar + sair */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 4 }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: color, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, flexShrink: 0,
            }}>
              {initials(user.name)}
            </div>
            <button
              className="btn ghost sm"
              onClick={logout}
              style={{ minWidth: 'unset', padding: '5px 10px' }}
            >
              Sair
            </button>
          </div>
        </nav>
      </div>

      {/* Toast de sync */}
      {syncMsg && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: syncMsg.type === 'ok' ? '#ecfdf5' : '#fef2f2',
          color:      syncMsg.type === 'ok' ? '#065f46' : '#991b1b',
          border: `1px solid ${syncMsg.type === 'ok' ? '#6ee7b7' : '#fca5a5'}`,
          borderRadius: 12, padding: '12px 20px',
          fontSize: 13, fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0,0,0,.12)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>{syncMsg.type === 'ok' ? '✅' : '❌'}</span>
          {syncMsg.text}
        </div>
      )}
    </>
  );
}
