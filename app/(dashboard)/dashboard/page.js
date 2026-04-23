import MetricCard from '@/app/components/metric-card';
import Avatar from '@/app/components/avatar';
import HourlyTimeline from '@/app/components/charts/hourly-timeline';
import CompositionDonut from '@/app/components/charts/composition-donut';
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
  if (member.lastSeenMin > 10) return { label: 'Offline', color: '#64748b', bg: '#e2e8f0' };
  if (member.isIdle)           return { label: 'Ocioso',  color: '#d97706', bg: '#fef3c7' };
  return                              { label: 'Online',  color: '#059669', bg: '#d1fae5' };
}

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
      acc.productive   += row.productive_sec   || 0;
      acc.neutral      += row.neutral_sec      || 0;
      acc.unproductive += row.unproductive_sec || 0;
      acc.idle         += row.idle_sec         || 0;
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

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <section className="grid" style={{ gap: 20 }}>

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 style={{ margin: 0 }}>Painel operacional</h1>
          <p className="muted" style={{ margin: '4px 0 0', textTransform: 'capitalize' }}>
            {today} — periodo: {from} ate {to}
          </p>
        </div>
        <div className="page-actions">
          <span className="badge badge-success">● {online.length} online</span>
          <span className="badge badge-warning">● {idle.length} ocioso</span>
          <span className="badge">● {offline.length} offline</span>
        </div>
      </div>

      {/* ── Alertas de ociosidade ── */}
      {idle.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid #d97706', background: '#fffbeb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{
              width: 32, height: 32, borderRadius: 8,
              background: '#fef3c7', color: '#92400e',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>⚠</span>
            <strong style={{ color: '#92400e' }}>
              {idle.length} colaborador{idle.length > 1 ? 'es' : ''} ocioso{idle.length > 1 ? 's' : ''} ha mais de 30 min
            </strong>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {idle.map(m => (
              <div key={m.id} style={{
                background: '#fff', border: '1px solid #fcd34d',
                borderRadius: 999, padding: '4px 12px 4px 4px', display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 13, color: '#92400e',
              }}>
                <Avatar name={m.name} size={24} />
                <span><strong>{m.name}</strong> — {m.lastSeenMin} min</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="grid grid-4">
        <MetricCard
          title="Tempo produtivo"
          value={formatDuration(totals.productive)}
          subtitle="Soma do periodo"
          icon="⚡"
          accent="brand"
        />
        <MetricCard
          title="Foco"
          value={pct(focus)}
          subtitle="Produtivo / ativo"
          icon="🎯"
          accent={focus >= 70 ? 'success' : focus >= 55 ? 'warning' : 'danger'}
        />
        <MetricCard
          title="Tempo ocioso"
          value={formatDuration(totals.idle)}
          subtitle="Inatividade total"
          icon="⏸"
          accent="warning"
        />
        <MetricCard
          title="Improdutivo"
          value={formatDuration(totals.unproductive)}
          subtitle="Fora do escopo"
          icon="⛔"
          accent="danger"
        />
      </div>

      {/* ── Gráficos lado a lado ── */}
      <div className="split-layout">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Atividade por hora — hoje</h3>
          <HourlyTimeline data={timeline} />
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Composicao geral</h3>
          <CompositionDonut
            productive={totals.productive}
            neutral={totals.neutral}
            unproductive={totals.unproductive}
            idle={totals.idle}
          />
        </div>
      </div>

      {/* ── Equipe agora ── */}
      <div className="card">
        <div className="flex-between" style={{ marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0 }}>Equipe agora</h3>
            <span className="muted" style={{ fontSize: 13 }}>Status em tempo real</span>
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 12 }} className="muted">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669' }} />
              Online: <strong>{online.length}</strong>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706' }} />
              Ocioso: <strong>{idle.length}</strong>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#64748b' }} />
              Offline: <strong>{offline.length}</strong>
            </span>
          </div>
        </div>

        {team.length === 0 ? (
          <div className="muted" style={{ textAlign: 'center', padding: 30 }}>
            Nenhum agente desktop conectado ainda. Instale o agente nos computadores dos colaboradores.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {team.map(member => {
              const s = statusInfo(member);
              return (
                <div key={member.id} style={{
                  border: '1px solid var(--line)',
                  borderRadius: 12, padding: 12,
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'var(--panel)',
                  transition: 'all 0.15s',
                }}>
                  <div style={{ position: 'relative' }}>
                    <Avatar name={member.name} size={38} />
                    <span style={{
                      position: 'absolute', right: -2, bottom: -2,
                      width: 12, height: 12, borderRadius: '50%',
                      background: s.color, border: '2px solid #fff',
                    }} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {member.name}
                    </div>
                    <div style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>
                      {s.label}{member.lastSeenMin <= 10 ? ` · ${member.lastSeenMin}m` : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
