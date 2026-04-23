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

function formatSize(bytes) {
  if (!bytes) return '-';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function RecordingsPage({ searchParams }) {
  await requireRoles(['admin']);
  const params = await searchParams;
  const range = defaultRange();
  const from = params?.from || range.from;
  const to = params?.to || range.to;
  const selectedUserId = params?.user_id || null;

  let users = [];
  let recordings = [];
  let errorMessage = '';

  try {
    users = await sql`
      SELECT
        ve.user_id,
        u.name,
        u.email,
        COUNT(*)::int AS total,
        MAX(ve.ts) AS last_ts
      FROM video_events ve
      JOIN users u ON u.id = ve.user_id
      WHERE ve.ts >= ${from}::date
        AND ve.ts < (${to}::date + INTERVAL '1 day')
      GROUP BY ve.user_id, u.name, u.email
      ORDER BY MAX(ve.ts) DESC
    `;

    const activeUserId = selectedUserId || users[0]?.user_id || null;
    if (activeUserId) {
      recordings = await sql`
        SELECT id, user_id, ts, app_name, url_domain, duration_sec, fps, size_bytes, width, height
        FROM video_events
        WHERE user_id = ${activeUserId}
          AND ts >= ${from}::date
          AND ts < (${to}::date + INTERVAL '1 day')
        ORDER BY ts DESC
        LIMIT 100
      `;
    }
  } catch (err) {
    errorMessage = err?.message || 'Erro ao carregar gravacoes';
  }

  const activeUserId = selectedUserId || users[0]?.user_id || null;
  const activeUser = users.find(u => u.user_id === activeUserId) || null;

  return (
    <section className="grid" style={{ gap: 20 }}>
      <div className="page-header">
        <div>
          <h1 style={{ margin: 0 }}>Gravacoes de Tela</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Clips de video curtos capturados automaticamente pelo agente.
          </p>
        </div>
        <div className="page-actions">
          <a className="btn ghost" href={`/reports/screenshots?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}>
            Ver Capturas
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
            {users.length === 0 && <option value="">Sem gravacoes no periodo</option>}
            {users.map(user => (
              <option key={user.user_id} value={user.user_id}>
                {user.name} ({user.total} gravacao(s))
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-inline" type="submit">Filtrar</button>
      </form>

      {errorMessage ? (
        <div className="card" style={{ color: '#b91c1c' }}>
          Falha ao carregar gravacoes: {errorMessage}
        </div>
      ) : null}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <h3 style={{ margin: 0 }}>Colaboradores</h3>
        </div>
        {users.length === 0 ? (
          <div className="muted" style={{ textAlign: 'center', padding: 24 }}>
            Nenhuma gravacao encontrada no periodo.
          </div>
        ) : (
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
            {users.map(user => (
              <a
                key={user.user_id}
                href={`/reports/recordings?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&user_id=${user.user_id}`}
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
                  <span className="badge">{user.total} gravacao(s)</span>
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
            {activeUser ? `Gravacoes de ${activeUser.name}` : 'Gravacoes'}
          </h3>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
            Clique em qualquer gravacao para assistir em tela cheia.
          </p>
        </div>
        {recordings.length === 0 ? (
          <div className="muted" style={{ textAlign: 'center', padding: 24 }}>
            Sem gravacoes para esse filtro.
          </div>
        ) : (
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {recordings.map((rec) => (
              <div
                key={rec.id}
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: '#fff',
                }}
              >
                <video
                  src={`/api/recordings/${rec.id}`}
                  controls
                  preload="metadata"
                  style={{ width: '100%', maxHeight: 220, display: 'block', background: '#0f172a' }}
                />
                <div style={{ padding: 10 }}>
                  <div style={{ fontSize: 12, color: '#334155', fontWeight: 700 }}>{rec.app_name || '(sem app)'}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{rec.url_domain || 'site nao identificado'}</div>
                  <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8' }}>
                    <span>{formatTs(rec.ts)}</span>
                    <span>
                      {rec.duration_sec ? `${rec.duration_sec}s` : ''}{rec.duration_sec && rec.fps ? ' · ' : ''}{rec.fps ? `${rec.fps}fps` : ''}
                      {rec.size_bytes ? ` · ${formatSize(rec.size_bytes)}` : ''}
                    </span>
                  </div>
                  {(rec.width && rec.height) ? (
                    <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 2 }}>{rec.width}×{rec.height}</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
