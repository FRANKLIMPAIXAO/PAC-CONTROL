import MetricCard from '@/app/components/metric-card';
import { requireSession } from '@/lib/auth-server';
import sql from '@/lib/db';
import { formatDuration, pct } from '@/lib/format';

// ── Demo data ────────────────────────────────────────────────────────────────

const DEMO_METRICS = [
  { user_id: 'u1', productive_sec: 18200, neutral_sec: 4500, unproductive_sec: 1800, idle_sec: 3600 },
  { user_id: 'u2', productive_sec: 21600, neutral_sec: 3200, unproductive_sec: 900,  idle_sec: 2700 },
  { user_id: 'u3', productive_sec: 14400, neutral_sec: 5400, unproductive_sec: 3600, idle_sec: 5400 },
  { user_id: 'u4', productive_sec: 25200, neutral_sec: 2700, unproductive_sec: 600,  idle_sec: 1800 },
  { user_id: 'u5', productive_sec: 16200, neutral_sec: 4800, unproductive_sec: 2400, idle_sec: 4200 },
];

const DEMO_TEAM = [
  { id: 'u1',  name: 'Ana Paula',      lastSeenMin: 2,   isIdle: false },
  { id: 'u2',  name: 'Carlos Lima',    lastSeenMin: 1,   isIdle: false },
  { id: 'u3',  name: 'Fernanda Costa', lastSeenMin: 2,   isIdle: true  },
  { id: 'u4',  name: 'Rafael Souza',   lastSeenMin: 3,   isIdle: false },
  { id: 'u5',  name: 'Juliana Mendes', lastSeenMin: 0,   isIdle: false },
  { id: 'u6',  name: 'Marcos Andrade', lastSeenMin: 180, isIdle: false },
  { id: 'u7',  name: 'Patricia Nunes', lastSeenMin: 1,   isIdle: true  },
  { id: 'u8',  name: 'Bruno Oliveira', lastSeenMin: 2,   isIdle: false },
  { id: 'u9',  name: 'Camila Torres',  lastSeenMin: 220, isIdle: false },
  { id: 'u10', name: 'Diego Ferreira', lastSeenMin: 1,   isIdle: false },
];

const DEMO_TIMELINE = [
  { hour: 8,  productive: 2400, neutral: 600,  unproductive: 0,   idle: 600  },
  { hour: 9,  productive: 3000, neutral: 400,  unproductive: 200, idle: 0    },
  { hour: 10, productive: 2800, neutral: 500,  unproductive: 100, idle: 200  },
  { hour: 11, productive: 3200, neutral: 200,  unproductive: 0,   idle: 200  },
  { hour: 12, productive: 600,  neutral: 300,  unproductive: 0,   idle: 2700 },
  { hour: 13, productive: 1800, neutral: 800,  unproductive: 400, idle: 600  },
  { hour: 14, productive: 3000, neutral: 300,  unproductive: 100, idle: 200  },
  { hour: 15, productive: 2700, neutral: 600,  unproductive: 300, idle: 0    },
  { hour: 16, productive: 2400, neutral: 700,  unproductive: 200, idle: 300  },
  { hour: 17, productive: 2100, neutral: 900,  unproductive: 0,   idle: 600  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultRange() {
  const to = new Date();
  const from = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function statusInfo(member) {
  if (member.lastSeenMin > 10) return { label: 'Offline', color: '#9ca3af', bg: '#f3f4f6' };
  if (member.isIdle)           return { label: 'Ocioso',  color: '#d97706', bg: '#fef3c7' };
  return                              { label: 'Online',  color: '#059669', bg: '#d1fae5' };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage({ searchParams }) {
  const session = await requireSession();
  const params  = await searchParams;
  const range   = defaultRange();
  const from    = params?.from || range.from;
  const to      = params?.to   || range.to;

  let data;
  if (process.env.DEMO_MODE === 'true') {
    data = DEMO_METRICS;
  } else {
    const filter = session.role === 'colaborador' ? sql`AND user_id = ${session.sub}` : sql``;
    data = await sql`
      SELECT user_id, productive_sec, neutral_sec, unproductive_sec, idle_sec
      FROM metrics_daily
      WHERE day >= ${from} AND day <= ${to} ${filter}
    `;
  }

  const totals = (data || []).reduce(
    (acc, row) => {
      acc.productive    += row.productive_sec    || 0;
      acc.neutral       += row.neutral_sec       || 0;
      acc.unproductive  += row.unproductive_sec  || 0;
      acc.idle          += row.idle_sec          || 0;
      return acc;
    },
    { productive: 0, neutral: 0, unproductive: 0, idle: 0 }
  );

  const active = totals.productive + totals.neutral + totals.unproductive;
  const focus  = active > 0 ? (totals.productive / active) * 100 : 0;

  const team     = process.env.DEMO_MODE === 'true' ? DEMO_TEAM : [];
  const timeline = process.env.DEMO_MODE === 'true' ? DEMO_TIMELINE : [];

  const online  = team.filter(m => m.lastSeenMin <= 10 && !m.isIdle);
  const idle    = team.filter(m => m.lastSeenMin <= 10 &&  m.isIdle);
  const offline = team.filter(m => m.lastSeenMin >  10);

  return (
    <section className="grid" style={{ gap: 20 }}>

      {/* ── Header ── */}
      <div className="card">
        <h1 style={{ margin: 0 }}>Painel PAC CONTROL</h1>
        <p className="muted" style={{ marginBottom: 0 }}>
          Visao operacional do periodo: {from} ate {to}
        </p>
      </div>

      {/* ── Alertas de ociosidade ── */}
      {idle.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid #d97706', background: '#fffbeb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <strong style={{ color: '#92400e' }}>
              {idle.length} colaborador{idle.length > 1 ? 'es' : ''} ocioso{idle.length > 1 ? 's' : ''} há mais de 30 min
            </strong>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {idle.map(m => (
              <span key={m.id} style={{
                background: '#fef3c7', border: '1px solid #fcd34d',
                borderRadius: 8, padding: '4px 12px', fontSize: 13, color: '#92400e'
              }}>
                {m.name} — {m.lastSeenMin} min ocioso
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Métricas resumo ── */}
      <div className="grid grid-3">
        <MetricCard title="Tempo produtivo" value={formatDuration(totals.productive)} subtitle="Soma do periodo" />
        <MetricCard title="Tempo ocioso"    value={formatDuration(totals.idle)}       subtitle="Inatividade" />
        <MetricCard title="Foco"            value={pct(focus)}                        subtitle="Produtivo / ativo" />
      </div>

      {/* ── Equipe agora ── */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>Equipe agora</h3>
          <div style={{ display: 'flex', gap: 14, fontSize: 12 }} className="muted">
            <span>🟢 Online: {online.length}</span>
            <span>🟡 Ocioso: {idle.length}</span>
            <span>⚫ Offline: {offline.length}</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
          {team.map(member => {
            const s = statusInfo(member);
            return (
              <div key={member.id} style={{
                border: '1px solid var(--line)', borderRadius: 10,
                padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10
              }}>
                <span style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: s.color, flexShrink: 0, display: 'inline-block'
                }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{member.name}</div>
                  <div style={{ fontSize: 11, color: s.color }}>{s.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Timeline intraday ── */}
      <div className="card">
        <h3 style={{ marginTop: 0, marginBottom: 4 }}>Atividade por hora — hoje</h3>
        <div style={{ display: 'flex', gap: 16, marginBottom: 14, fontSize: 12 }} className="muted">
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: '#0f766e', display: 'inline-block' }} /> Produtivo
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: '#6366f1', display: 'inline-block' }} /> Neutro
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: '#f59e0b', display: 'inline-block' }} /> Ocioso
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: '#ef4444', display: 'inline-block' }} /> Improdutivo
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 100 }}>
          {timeline.map(slot => {
            const total = slot.productive + slot.neutral + slot.unproductive + slot.idle || 1;
            const pPct  = (slot.productive    / total) * 100;
            const nPct  = (slot.neutral       / total) * 100;
            const iPct  = (slot.idle          / total) * 100;
            const uPct  = (slot.unproductive  / total) * 100;
            return (
              <div key={slot.hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: '100%', height: 80, display: 'flex', flexDirection: 'column', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ flex: pPct, background: '#0f766e' }} title={`Produtivo: ${pPct.toFixed(0)}%`} />
                  <div style={{ flex: nPct, background: '#6366f1' }} title={`Neutro: ${nPct.toFixed(0)}%`} />
                  <div style={{ flex: uPct, background: '#ef4444' }} title={`Improdutivo: ${uPct.toFixed(0)}%`} />
                  <div style={{ flex: iPct, background: '#f59e0b' }} title={`Ocioso: ${iPct.toFixed(0)}%`} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{slot.hour}h</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Leitura rápida ── */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Leitura rapida</h3>
        <p className="muted" style={{ margin: 0 }}>
          Tempo neutro: <strong>{formatDuration(totals.neutral)}</strong> &nbsp;•&nbsp;
          Tempo improdutivo: <strong>{formatDuration(totals.unproductive)}</strong>
        </p>
      </div>

    </section>
  );
}
