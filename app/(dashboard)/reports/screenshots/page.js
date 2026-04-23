import { requireRoles } from '@/lib/auth-server';
import sql from '@/lib/db';

const APP_TIMEZONE = 'America/Sao_Paulo';

function defaultRange() {
  const to = new Date();
  const from = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function formatTs(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR', { timeZone: APP_TIMEZONE });
}

export default async function ScreenshotsPage({ searchParams }) {
  await requireRoles(['admin']);
  const params = await searchParams;
  const range = defaultRange();
  const from = params?.from || range.from;
  const to = params?.to || range.to;
  const selectedUserId = params?.user_id || null;

  let users = [];
  let shots = [];
  let errorMessage = '';

  try {
    users = await sql`
      SELECT
        se.user_id,
        u.name,
        u.email,
        COUNT(*)::int AS shots,
        MAX(se.ts) AS last_ts
      FROM screenshot_events se
      JOIN users u ON u.id = se.user_id
      WHERE se.ts >= ${from}::date
        AND se.ts < (${to}::date + INTERVAL '1 day')
      GROUP BY se.user_id, u.name, u.email
      ORDER BY MAX(se.ts) DESC
    `;

    const activeUserId = selectedUserId || users[0]?.user_id || null;
    if (activeUserId) {
      shots = await sql`
        SELECT id, user_id, ts, app_name, url_domain
        FROM screenshot_events
        WHERE user_id = ${activeUserId}
          AND ts >= ${from}::date
          AND ts < (${to}::date + INTERVAL '1 day')
        ORDER BY ts DESC
        LIMIT 300
      `;
    }
  } catch (err) {
    errorMessage = err?.message || 'Erro ao carregar capturas';
  }

  const activeUserId = selectedUserId || users[0]?.user_id || null;
  const activeUser = users.find(u => u.user_id === activeUserId) || null;

  return (
    <section className="grid" style={{ gap: 20 }}>
      <div className="page-header">
        <div>
          <h1 style={{ margin: 0 }}>Galeria de Capturas</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Admin: blocos por colaborador e filtro por periodo.
          </p>
        </div>
        <div className="page-actions">
          <a className="btn ghost" href={`/reports/recordings?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}>
            Ver Gravacoes
          </a>
          <a className="btn ghost" href={`/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}>
            Voltar para Analises
          </a>
        </div>
      </div>

      <form method="GET" className="card filter-form">
        <div style={{ minWidth: 170 }}>
          <label className="muted" style={{ display: 'block', marginBottom: 6 }}>Data inicial</label>
          <input className="input" type="date" name="from" defaultValue={from} />
        </div>
        <div style={{ minWidth: 170 }}>
          <label className="muted" style={{ display: 'block', marginBottom: 6 }}>Data final</label>
          <input className="input" type="date" name="to" defaultValue={to} />
        </div>
        <div style={{ minWidth: 260, flex: 1 }}>
          <label className="muted" style={{ display: 'block', marginBottom: 6 }}>Colaborador</label>
          <select className="input" name="user_id" defaultValue={activeUserId || ''}>
            {users.length === 0 && <option value="">Sem capturas no periodo</option>}
            {users.map(user => (
              <option key={user.user_id} value={user.user_id}>
                {user.name} ({user.shots} capturas)
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-inline" type="submit">Filtrar</button>
      </form>

      {errorMessage ? (
        <div className="card" style={{ color: '#b91c1c' }}>
          Falha ao carregar capturas: {errorMessage}
        </div>
      ) : null}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <h3 style={{ margin: 0 }}>Blocos por colaborador</h3>
        </div>
        {users.length === 0 ? (
          <div className="muted" style={{ textAlign: 'center', padding: 24 }}>
            Nenhuma captura encontrada no periodo.
          </div>
        ) : (
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
            {users.map(user => (
              <a
                key={user.user_id}
                href={`/reports/screenshots?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&user_id=${user.user_id}`}
                style={{
                  border: user.user_id === activeUserId ? '2px solid #2563eb' : '1px solid var(--line)',
                  borderRadius: 12,
                  textDecoration: 'none',
                  color: 'inherit',
                  background: '#fff',
                  padding: 12,
                }}
              >
                <div style={{ fontSize: 14, color: '#0f172a', fontWeight: 800 }}>{user.name || 'Sem nome'}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{user.email || '-'}</div>
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge">{user.shots} captura(s)</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{formatTs(user.last_ts)}</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <h3 style={{ margin: 0 }}>
            {activeUser ? `Capturas de ${activeUser.name}` : 'Capturas'}
          </h3>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
            Clique em qualquer miniatura para abrir em tamanho original.
          </p>
        </div>
        {shots.length === 0 ? (
          <div className="muted" style={{ textAlign: 'center', padding: 24 }}>
            Sem capturas para esse filtro.
          </div>
        ) : (
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            {shots.map((shot, idx) => (
              <a
                key={shot.id}
                href={`/api/screenshots/${shot.id}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  textDecoration: 'none',
                  color: 'inherit',
                  background: '#fff',
                }}
              >
                <img
                  src={`/api/screenshots/${shot.id}`}
                  alt={`Screenshot ${idx + 1}`}
                  style={{ width: '100%', height: 170, objectFit: 'cover', display: 'block', background: '#f8fafc' }}
                  loading="lazy"
                />
                <div style={{ padding: 10 }}>
                  <div style={{ fontSize: 12, color: '#334155', fontWeight: 700 }}>{shot.app_name || '(sem app)'}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{shot.url_domain || 'site nao identificado'}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{formatTs(shot.ts)}</div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
