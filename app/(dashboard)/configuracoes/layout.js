'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/configuracoes/empresa',       label: 'Empresa' },
  { href: '/configuracoes/times',         label: 'Times' },
  { href: '/configuracoes/colaboradores', label: 'Colaboradores' },
  { href: '/configuracoes/metas',         label: 'Metas' },
];

export default function ConfiguracoesLayout({ children }) {
  const pathname = usePathname();

  return (
    <section className="grid" style={{ gap: 20 }}>
      <div className="card">
        <h1 style={{ margin: 0 }}>Configuracoes</h1>
        <p className="muted" style={{ marginBottom: 0 }}>
          Gerencie sua empresa, times, colaboradores e metas de produtividade.
        </p>
      </div>

      <div className="card" style={{ padding: 8 }}>
        <nav style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {TABS.map(tab => {
            const active = pathname === tab.href || pathname.startsWith(tab.href + '/');
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="badge"
                style={{
                  fontWeight: active ? 700 : 500,
                  background: active ? '#0f766e' : 'transparent',
                  color: active ? 'white' : '#0f766e',
                  border: active ? 'none' : '1px solid #0f766e',
                  padding: '8px 16px',
                  borderRadius: 8,
                  textDecoration: 'none',
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </section>
  );
}
