import MetricCard from '@/app/components/metric-card';
import HourlyTimeline from '@/app/components/charts/hourly-timeline';
import CompositionDonut from '@/app/components/charts/composition-donut';
import { requireSession } from '@/lib/auth-server';
import sql from '@/lib/db';
import { formatDuration, pct } from '@/lib/format';

/* ── Demo ───────────────────────────────────────────────────── */
const DEMO_METRICS = [
  { user_id:'u1', productive_sec:18200, neutral_sec:4500, unproductive_sec:1800, idle_sec:3600 },
  { user_id:'u2', productive_sec:21600, neutral_sec:3200, unproductive_sec:900,  idle_sec:2700 },
  { user_id:'u3', productive_sec:14400, neutral_sec:5400, unproductive_sec:3600, idle_sec:5400 },
  { user_id:'u4', productive_sec:25200, neutral_sec:2700, unproductive_sec:600,  idle_sec:1800 },
  { user_id:'u5', productive_sec:16200, neutral_sec:4800, unproductive_sec:2400, idle_sec:4200 },
];
const DEMO_TEAM = [
  { id:'u1', name:'Ana Paula',      lastSeenMin:2,  isIdle:false, productive:18200, total:28100 },
  { id:'u2', name:'Carlos Lima',    lastSeenMin:1,  isIdle:false, productive:21600, total:28400 },
  { id:'u3', name:'Fernanda Costa', lastSeenMin:4,  isIdle:true,  productive:14400, total:28800 },
  { id:'u4', name:'Rafael Souza',   lastSeenMin:0,  isIdle:false, productive:25200, total:30300 },
  { id:'u5', name:'Juliana Mendes', lastSeenMin:62, isIdle:false, productive:16200, total:27600 },
];
const DEMO_TIMELINE = [
  { hour:8,  productive:2400, neutral:600,  unproductive:0,   idle:600  },
  { hour:9,  productive:3000, neutral:400,  unproductive:200, idle:0    },
  { hour:10, productive:2800, neutral:500,  unproductive:100, idle:200  },
  { hour:11, productive:3200, neutral:200,  unproductive:0,   idle:200  },
  { hour:12, productive:600,  neutral:300,  unproductive:0,   idle:2700 },
  { hour:13, productive:1800, neutral:800,  unproductive:400, idle:600  },
  { hour:14, productive:3000, neutral:300,  unproductive:100, idle:200  },
  { hour:15, productive:2700, neutral:600,  unproductive:300, idle:0    },
  { hour:16, productive:2400, neutral:700,  unproductive:200, idle:300  },
  { hour:17, productive:2100, neutral:900,  unproductive:0,   idle:600  },
];

/* ── Helpers ─────────────────────────────────────────────────── */
const AVATAR_COLORS = ['#1e40af','#059669','#7c3aed','#d97706','#dc2626','#0ea5e9','#db2777','#065f46'];
function hashColor(name='') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(name='') {
  return name.split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();
}
function statusOf(member) {
  if (member.lastSeenMin > 10) return { label:'Offline', cls:'offline', color:'#9ca3af' };
  if (member.isIdle)           return { label:'Ocioso',  cls:'idle',    color:'#d97706' };
  return                              { label:'Online',  cls:'online',  color:'#059669' };
}
function focoPct(productive, total) {
  if (!total) return 0;
  return Math.round(productive / total * 100);
}
function focoBg(pct) {
  if (pct >= 70) return 'linear-gradient(90deg,#059669,#10b981)';
  if (pct >= 50) return 'linear-gradient(90deg,#d97706,#f59e0b)';
  return 'linear-gradient(90deg,#dc2626,#ef4444)';
}

function defaultRange() {
  const to   = new Date();
  const from = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().slice(0,10), to: to.toISOString().slice(0,10) };
}

const APP_TZ = 'America/Sao_Paulo';

/* ── Page ────────────────────────────────────────────────────── */
export default async function DashboardPage({ searchParams }) {
  const session = await requireSession();
  const params  = await searchParams;
  const range   = defaultRange();
  const from    = params?.from || range.from;
  const to      = params?.to   || range.to;

  /* Métricas do período */
  let data;
  if (process.env.DEMO_MODE === 'true') {
    data = DEMO_METRICS;
  } else {
    const cf = session.role === 'colaborador'
      ? sql`AND md.user_id = ${session.sub}`
      : sql`AND u.company_id = ${session.company_id}`;
    data = await sql`
      SELECT md.user_id, md.productive_sec, md.neutral_sec, md.unproductive_sec, md.idle_sec
      FROM metrics_daily md
      JOIN users u ON u.id = md.user_id
      WHERE md.day >= ${from} AND md.day <= ${to} ${cf}
    `;
  }

  const totals = (data || []).reduce(
    (a, r) => ({
      productive:   a.productive   + Number(r.productive_sec   || 0),
      neutral:      a.neutral      + Number(r.neutral_sec      || 0),
      unproductive: a.unproductive + Number(r.unproductive_sec || 0),
      idle:         a.idle         + Number(r.idle_sec         || 0),
    }),
    { productive:0, neutral:0, unproductive:0, idle:0 }
  );

  const active = totals.productive + totals.neutral + totals.unproductive;
  const focus  = active > 0 ? (totals.productive / active) * 100 : 0;

  /* Equipe agora */
  let team     = [];
  let timeline = [];

  if (process.env.DEMO_MODE === 'true') {
    team     = DEMO_TEAM;
    timeline = DEMO_TIMELINE;
  } else if (session.role === 'admin' || session.role === 'manager') {
    try {
      /* Busca último heartbeat + métricas de hoje por usuário */
      const devices = await sql`
        SELECT DISTINCT ON (u.id)
               u.id, u.name,
               d.last_idle_state                                   AS is_idle,
               EXTRACT(EPOCH FROM (NOW() - d.last_seen_at)) / 60  AS last_seen_min
        FROM users u
        JOIN devices d ON d.user_id = u.id
        WHERE u.company_id = ${session.company_id}
          AND u.status = 'active' AND u.role != 'admin'
        ORDER BY u.id, d.last_seen_at DESC
      `;

      /* Métricas de hoje para score de foco */
      const today = new Date().toISOString().slice(0,10);
      const todayMetrics = await sql`
        SELECT md.user_id,
               COALESCE(SUM(md.productive_sec),0)   AS prod,
               COALESCE(SUM(md.neutral_sec),0)      AS neutral,
               COALESCE(SUM(md.unproductive_sec),0) AS unprod,
               COALESCE(SUM(md.idle_sec),0)         AS idle
        FROM metrics_daily md
        JOIN users u ON u.id = md.user_id
        WHERE u.company_id = ${session.company_id}
          AND md.day = ${today}
        GROUP BY md.user_id
      `;
      const metricsMap = {};
      for (const m of todayMetrics) metricsMap[m.user_id] = m;

      team = devices.map(d => {
        const m = metricsMap[d.id] || {};
        const prod  = Number(m.prod    || 0);
        const tot   = prod + Number(m.neutral || 0) + Number(m.unprod || 0) + Number(m.idle || 0);
        return {
          id:          d.id,
          name:        d.name,
          lastSeenMin: Math.round(Number(d.last_seen_min ?? 9999)),
          isIdle:      Boolean(d.is_idle),
          productive:  prod,
          total:       tot,
        };
      });
    } catch { /* sem dispositivos */ }

    try {
      const rows = await sql`
        SELECT
          EXTRACT(HOUR FROM (er.ts AT TIME ZONE ${APP_TZ}))::int      AS hour,
          COUNT(*) FILTER (WHERE NOT er.is_idle)::int                  AS productive,
          COUNT(*) FILTER (WHERE er.is_idle)::int                      AS idle
        FROM events_raw er
        JOIN users u ON u.id = er.user_id
        WHERE u.company_id = ${session.company_id}
          AND er.ts >= (date_trunc('day', (NOW() AT TIME ZONE ${APP_TZ})) AT TIME ZONE ${APP_TZ})
          AND er.ts <  ((date_trunc('day', (NOW() AT TIME ZONE ${APP_TZ})) + INTERVAL '1 day') AT TIME ZONE ${APP_TZ})
        GROUP BY 1 ORDER BY 1
      `;
      timeline = rows.map(h => ({
        hour: h.hour,
        productive:   Number(h.productive) * 10,
        neutral:      0,
        unproductive: 0,
        idle:         Number(h.idle) * 10,
      }));
    } catch { /* sem eventos hoje */ }
  }

  const online  = team.filter(m => m.lastSeenMin <= 10 && !m.isIdle);
  const idleArr = team.filter(m => m.lastSeenMin <= 10 &&  m.isIdle);
  const offline = team.filter(m => m.lastSeenMin >  10);

  const today = new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long' });

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, color:'#0d1117' }}>Painel operacional</h1>
          <p className="muted" style={{ margin:'4px 0 0', fontSize:13, textTransform:'capitalize' }}>
            {today} &mdash; Periodo: {from} ate {to}
          </p>
        </div>
        <div className="page-actions">
          <span className="badge badge-success" style={{ fontSize:12, padding:'5px 12px' }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#059669', display:'inline-block' }} />
            {online.length} online
          </span>
          <span className="badge badge-warning" style={{ fontSize:12, padding:'5px 12px' }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#d97706', display:'inline-block' }} />
            {idleArr.length} ocioso
          </span>
          <span className="badge" style={{ fontSize:12, padding:'5px 12px' }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#9ca3af', display:'inline-block' }} />
            {offline.length} offline
          </span>
        </div>
      </div>

      {/* ── Alerta ociosos ── */}
      {idleArr.length > 0 && (
        <div className="alert warning" style={{ borderRadius:12 }}>
          <span className="alert-icon">⚠️</span>
          <div>
            <div style={{ fontWeight:700, marginBottom:8 }}>
              {idleArr.length} colaborador{idleArr.length > 1?'es':''} ocioso{idleArr.length > 1?'s':''} ha mais de 5 min
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {idleArr.map(m => (
                <span key={m.id} style={{
                  background:'#fff', border:'1px solid #fcd34d', borderRadius:999,
                  padding:'3px 10px 3px 4px', display:'flex', alignItems:'center', gap:6, fontSize:12,
                }}>
                  <span style={{
                    width:22, height:22, borderRadius:'50%',
                    background: hashColor(m.name), color:'#fff',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:9, fontWeight:700,
                  }}>{initials(m.name)}</span>
                  <strong>{m.name}</strong> — {m.lastSeenMin}m
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="grid grid-4">
        <MetricCard
          title="Tempo produtivo"
          value={formatDuration(totals.productive)}
          subtitle={`Periodo: ${from} a ${to}`}
          icon="⚡"
          accent="brand"
        />
        <MetricCard
          title="Indice de foco"
          value={pct(focus)}
          subtitle="Produtivo / ativo"
          icon="🎯"
          accent={focus >= 70 ? 'success' : focus >= 50 ? 'warning' : 'danger'}
        />
        <MetricCard
          title="Tempo ocioso"
          value={formatDuration(totals.idle)}
          subtitle="Inatividade acumulada"
          icon="⏸"
          accent="warning"
        />
        <MetricCard
          title="Improdutivo"
          value={formatDuration(totals.unproductive)}
          subtitle="Fora do escopo"
          icon="🚫"
          accent="danger"
        />
      </div>

      {/* ── Graficos ── */}
      <div className="split-layout">
        <div className="card">
          <div className="section-title">
            📊 Atividade por hora — hoje
            {timeline.length > 0 && (
              <span className="section-title-sub badge badge-success" style={{ borderRadius:999, fontSize:11 }}>
                {timeline.length} horas com dados
              </span>
            )}
          </div>
          {timeline.length === 0 ? (
            <div className="empty-state" style={{ padding:'32px 0' }}>
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-title">Sem atividade registrada hoje ainda</div>
              <div className="empty-state-sub">Os dados aparecem assim que o agente enviar heartbeats</div>
            </div>
          ) : (
            <HourlyTimeline data={timeline} />
          )}
        </div>
        <div className="card">
          <div className="section-title">🥧 Composicao geral</div>
          <CompositionDonut
            productive={totals.productive}
            neutral={totals.neutral}
            unproductive={totals.unproductive}
            idle={totals.idle}
          />
        </div>
      </div>

      {/* ── Equipe agora — cards estilo WorkMonitor ── */}
      <div className="card">
        <div className="flex-between" style={{ marginBottom:20 }}>
          <div>
            <div className="section-title" style={{ marginBottom:4 }}>
              👥 Equipe agora
            </div>
            <p className="muted" style={{ fontSize:12, margin:0 }}>
              Status em tempo real via heartbeat do agente desktop (&lt;10 min = ativo)
            </p>
          </div>
          <div style={{ display:'flex', gap:16, fontSize:12 }}>
            {[
              { label:'Online',  count:online.length,  color:'#059669', bg:'#ecfdf5' },
              { label:'Ocioso',  count:idleArr.length, color:'#d97706', bg:'#fffbeb' },
              { label:'Offline', count:offline.length, color:'#9ca3af', bg:'#f9fafb' },
            ].map(s => (
              <div key={s.label} style={{
                display:'flex', alignItems:'center', gap:6, fontWeight:600,
                background:s.bg, padding:'4px 12px', borderRadius:999,
                fontSize:12, color:s.color,
              }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background:s.color }} />
                {s.label}: <strong>{s.count}</strong>
              </div>
            ))}
          </div>
        </div>

        {team.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🖥️</div>
            <div className="empty-state-title">Nenhum agente conectado ainda</div>
            <div className="empty-state-sub">
              Instale o agente desktop nos computadores dos colaboradores para ver o status em tempo real
            </div>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:12 }}>
            {team.map(member => {
              const s    = statusOf(member);
              const foco = focoPct(member.productive, member.total);
              const clr  = hashColor(member.name);
              return (
                <div key={member.id} className="user-card">
                  {/* Header */}
                  <div className="user-card-header">
                    <div className="user-card-avatar">
                      <div style={{
                        width:44, height:44, borderRadius:'50%',
                        background:clr, color:'#fff',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:14, fontWeight:800,
                      }}>{initials(member.name)}</div>
                      <span style={{
                        position:'absolute', right:-1, bottom:-1,
                        width:14, height:14, borderRadius:'50%',
                        background:s.color, border:'2px solid #fff',
                      }} />
                    </div>
                    <div className="user-card-info">
                      <div className="user-card-name">{member.name}</div>
                      <div className={`user-card-status ${s.cls}`}>
                        {s.label}
                        {member.lastSeenMin <= 10 ? ` · ${member.lastSeenMin}m` : ` · ${member.lastSeenMin >= 60 ? Math.floor(member.lastSeenMin/60)+'h' : member.lastSeenMin+'m'}`}
                      </div>
                    </div>
                  </div>

                  {/* Score de foco hoje */}
                  {member.total > 0 && (
                    <div className="score-bar-wrap">
                      <div className="score-bar-label">
                        <span>Foco hoje</span>
                        <span style={{ fontWeight:700, color: foco >= 70 ? '#059669' : foco >= 50 ? '#d97706' : '#dc2626' }}>
                          {foco}%
                        </span>
                      </div>
                      <div className="score-bar-track">
                        <div className="score-bar-fill" style={{
                          width:`${Math.min(foco,100)}%`,
                          background: focoBg(foco),
                        }} />
                      </div>
                      <div style={{ fontSize:11, color:'#9ca3af' }}>
                        Prod: {formatDuration(member.productive)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
