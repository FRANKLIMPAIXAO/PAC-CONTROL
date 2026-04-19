'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function TopNav({ user }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="topnav card">
      <div>
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
        <button onClick={logout} style={{ width: 'auto', padding: '8px 12px' }}>
          Sair
        </button>
      </nav>
    </div>
  );
}
