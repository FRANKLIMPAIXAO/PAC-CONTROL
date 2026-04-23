'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

export default function TopNav({ user }) {
  const pathname = usePathname();
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  async function syncToday() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch('/api/admin/sync-today', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setSyncMsg({ type: 'ok', text: `✅ Sincronizado! ${data.users_processed} colaborador(es) atualizados.` });
        setTimeout(() => {
          setSyncMsg(null);
          router.refresh();
        }, 2500);
      } else {
        setSyncMsg({ type: 'err', text: `❌ ${data.error || 'Erro ao sincronizar'}` });
        setTimeout(() => setSyncMsg(null), 4000);
      }
    } catch {
      setSyncMsg({ type: 'err', text: '❌ Erro de conexão' });
      setTimeout(() => setSyncMsg(null), 4000);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <div className="topnav card">
        <div className="topnav-brand">
          <strong>PAC CONTROL</strong>
          <div className="muted">{user.name} • {user.email}</div>
        </div>

        <nav>
          <Link href="/dashboard" className="badge" style={{ fontWeight: pathname === '/dashboard' ? 700 : 400 }}>
            Painel
          </Link>
          {(user.role === 'admin') && (
            <Link href="/reports" className="badge" style={{ fontWeight: pathname === '/reports' ? 700 : 400 }}>
              Analises
            </Link>
          )}
          {(user.role === 'admin') && (
            <Link href="/configuracoes" className="badge" style={{ fontWeight: pathname.startsWith('/configuracoes') ? 700 : 400 }}>
              Configuracoes
            </Link>
          )}
          <Link href="/perfil" className="badge" style={{ fontWeight: pathname === '/perfil' ? 700 : 400 }}>
            Meu perfil
          </Link>
          <span className="badge">Nivel: {user.role}</span>

          {user.role === 'admin' && (
            <button
              className="btn btn-inline"
              id="btn-sync-today"
              onClick={syncToday}
              disabled={syncing}
              title="Recalcular métricas do dia agora, sem esperar a madrugada"
              style={{
                padding: '8px 14px',
                fontSize: 13,
                background: syncing ? '#0b5a54' : '#0f766e',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 15 }}>{syncing ? '⏳' : '🔄'}</span>
              {syncing ? 'Sincronizando...' : 'Sincronizar Hoje'}
            </button>
          )}

          <button onClick={logout} className="btn btn-inline" style={{ padding: '8px 12px' }}>
            Sair
          </button>
        </nav>
      </div>

      {syncMsg && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
          background: syncMsg.type === 'ok' ? '#d1fae5' : '#fee2e2',
          color: syncMsg.type === 'ok' ? '#065f46' : '#991b1b',
          border: `1px solid ${syncMsg.type === 'ok' ? '#6ee7b7' : '#fca5a5'}`,
          borderRadius: 10,
          padding: '14px 20px',
          fontSize: 14,
          fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          maxWidth: 360,
          left: 16,
        }}>
          {syncMsg.text}
        </div>
      )}
    </>
  );
}
