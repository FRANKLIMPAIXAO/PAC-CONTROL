import HourlyTimeline from '@/app/components/charts/hourly-timeline';
import ProductivityGauge from '@/app/components/charts/productivity-gauge';
import { requireSession } from '@/lib/auth-server';
import sql from '@/lib/db';
import { formatDuration } from '@/lib/format';

/* ── Demo ───────────────────────────────────────────────────── */
const DEMO_METRICS = [
  { user_id:'u1', productive_sec:18200, neutral_sec:4500, unproductive_sec:1800, idle_sec:3600 },
  { user_id:'u2', productive_sec:21600, neutral_sec:3200, unproductive_sec:900,  idle_sec:2700 },
  { user_id:'u3', productive_sec:14400, neutral_sec:5400, unproductive_sec:3600, idle_sec:5400 },
  { user_id:'u4', productive_sec:25200, neutral_sec:2700, unproductive_sec:600,  idle_sec:1800 },
  { user_id:'u5', productive_sec:16200, neutral_sec:4800, unproductive_sec:2400, idle_sec:4200 },
];
const DEMO_TEAM = [
  { id:'u1', name:'Ana Paula',      lastSeenMin:2,  isIdle:false, productive:18200, neutral:4500, unproductive:1800, idle:3600  },
  { id:'u2', name:'Carlos Lima',    lastSeenMin:1,  isIdle:false, productive:21600, neutral:3200, unproductive:900,  idle:2700  },
  { id:'u3', name:'Fernanda Costa', lastSeenMin:4,  isIdle:true,  productive:14400, neutral:5400, unproductive:3600, idle:5400  },
  { id:'u4', name:'Rafael Souza',   lastSeenMin:0,  isIdle:false, productive:25200, neutral:2700, unproductive:600,  idle:1800  },
  { id:'u5', name:'Juliana Mendes', lastSeenMin:62, isIdle:false, productive:16200, neutral:4800, unproductive:2400, idle:4200  },
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
function statusOf(m) {
  if (m.lastSeenMin > 10) return { label:'Offline', dot:'#9ca3af', bg:'#f3f4f6', text:'#6b7280' };
  if (m.isIdle)           return { label:'Ocioso',  dot:'#d97706', bg:'#fffbeb', text:'#92400e' };
  return                         { label:'Online',  dot:'#059669', bg:'#ecfdf5', text:'#065f46' };
}

const APP_TZ = 'America/Sao_Paulo';

/* ── Page ────────────────────────────────────────────────────── */
export default async function DashboardPage({ searchParams }) {
  const session = await requireSession();
  const params  = await searchParams;

  const toDate   = new Date();
  const fromDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
  const from     = params?.from || fromDate.toISOString().slice(0,10);
  const to       = params?.to   || toDate.toISOString().slice(0,10);

  /* ── Métricas do período ── */
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

  /* ── Equipe agora ── */
  let team     = [];
  let timeline = [];

  if (process.env.DEMO_MODE === 'true') {
    team     = DEMO_TEAM;
    timeline = DEMO_TIMELINE;
  } else if (session.role === 'admin' || session.role === 'manager') {
    try {
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
      const mm = {};
      for (const m of todayMetrics) mm[m.user_id] = m;

      team = devices.map(d => {
        const m = mm[d.id] || {};
        return {
          id:          d.id,
          name:        d.name,
          lastSeenMin: Math.round(Number(d.last_seen_min ?? 9999)),
          isIdle:      Boolean(d.is_idle),
          productive:  Number(m.prod    || 0),
          neutral:     Number(m.neutral || 0),
          unproductive:Number(m.unprod  || 0),
          idle:        Number(m.idle    || 0),
        };
      });
    } catch { /* sem dispositivos */ }

    try {
      const rows = await sql`
        SELECT
          EXTRACT(HOUR FROM (er.ts AT TIME ZONE ${APP_TZ}))::int AS hour,
          COUNT(*) FILTER (WHERE NOT er.is_idle)::int             AS productive,
          COUNT(*) FILTER (WHERE er.is_idle)::int                 AS idle
        FROM events_raw er
        JOIN users u ON u.id = er.user_id
        WHERE u.company_id = ${session.company_id}
          AND er.ts >= (date_trunc('day', (NOW() AT TIME ZONE ${APP_TZ})) AT TIME ZONE ${APP_TZ})
          AND er.ts <  ((date_trunc('day', (NOW() AT TIME ZONE ${APP_TZ})) + INTERVAL '1 day') AT TIME ZONE ${APP_TZ})
        GROUP BY 1 ORDER BY 1
      `;
      timeline = rows.map(h => ({
        hour:         h.hour,
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

  /* ordena: online primeiro, depois ocioso, depois offline */
  const teamSorted = [...online, ...idleArr, ...offline];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, color:'#0d1117', fontSize:20, fontWeight:800 }}>Painel operacional</h1>
          <p className="muted" style={{ margin:'3px 0 0', fontSize:12, textTransform:'capitalize' }}>
            {today} &mdash; Período: {from} a {to}
          </p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {[
            { label:'Online',  count:online.length,  color:'#059669', bg:'#ecfdf5' },
            { label:'Ocioso',  count:idleArr.length, color:'#d97706', bg:'#fffbeb' },
            { label:'Offline', count:offline.length, color:'#9ca3af', bg:'#f9fafb' },
          ].map(s => (
            <div key={s.label} style={{
              display:'flex', alignItems:'center', gap:6, fontWeight:600,
              background:s.bg, padding:'5px 14px', borderRadius:999,
              fontSize:12, color:s.color, border:`1px solid ${s.color}22`,
            }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:s.color }} />
              {s.label}: <strong>{s.count}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* ── Alerta ociosos ── */}
      {idleArr.length > 0 && (
        <div className="alert warning" style={{ borderRadius:12 }}>
          <span className="alert-icon">⚠️</span>
          <div>
            <div style={{ fontWeight:700, marginBottom:8 }}>
              {idleArr.length} colaborador{idleArr.length > 1?'es':''} ocioso{idleArr.length > 1?'s':''} há mais de 5 min
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {idleArr.map(m => (
                <span key={m.id} style={{
                  background:'#fff', border:'1px solid #fcd34d', borderRadius:999,
                  padding:'3px 10px 3px 4px', display:'flex', alignItems:'center', gap:6, fontSize:12,
                }}>
                  <span style={{
                    width:22, height:22, borderRadius:'50%',
                    background:hashColor(m.name), color:'#fff',
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

      {/* ── KPIs + Gauge ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto', gap:16, alignItems:'stretch' }}>
        {/* KPI produtivo */}
        <div className="card" style={{ padding:'18px 20px' }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'#6b7280', marginBottom:10 }}>
            ⚡ Tempo produtivo
          </div>
          <div style={{ fontSize:28, fontWeight:800, color:'#059669', lineHeight:1.1 }}>
            {formatDuration(totals.productive)}
          </div>
          <div style={{ fontSize:11, color:'#9ca3af', marginTop:6 }}>Período: {from} a {to}</div>
          <div style={{ marginTop:10, height:4, borderRadius:999, background:'#e5e7eb', overflow:'hidden' }}>
            <div style={{ height:'100%', borderRadius:999, background:'#059669', width:`${Math.min(100,focus)}%` }} />
          </div>
        </div>

        {/* KPI ocioso */}
        <div className="card" style={{ padding:'18px 20px' }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'#6b7280', marginBottom:10 }}>
            ⏸ Tempo ocioso
          </div>
          <div style={{ fontSize:28, fontWeight:800, color:'#d97706', lineHeight:1.1 }}>
            {formatDuration(totals.idle)}
          </div>
          <div style={{ fontSize:11, color:'#9ca3af', marginTop:6 }}>Inatividade acumulada</div>
          <div style={{ marginTop:10, height:4, borderRadius:999, background:'#e5e7eb', overflow:'hidden' }}>
            <div style={{ height:'100%', borderRadius:999, background:'#d97706',
              width:`${active+totals.idle > 0 ? Math.min(100, totals.idle/(active+totals.idle)*100) : 0}%` }} />
          </div>
        </div>

        {/* KPI improdutivo */}
        <div className="card" style={{ padding:'18px 20px' }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'#6b7280', marginBottom:10 }}>
            🚫 Improdutivo
          </div>
          <div style={{ fontSize:28, fontWeight:800, color:'#dc2626', lineHeight:1.1 }}>
            {formatDuration(totals.unproductive)}
          </div>
          <div style={{ fontSize:11, color:'#9ca3af', marginTop:6 }}>Fora do escopo</div>
          <div style={{ marginTop:10, height:4, borderRadius:999, background:'#e5e7eb', overflow:'hidden' }}>
            <div style={{ height:'100%', borderRadius:999, background:'#dc2626',
              width:`${active > 0 ? Math.min(100, totals.unproductive/active*100) : 0}%` }} />
          </div>
        </div>

        {/* Gauge */}
        <div className="card" style={{ padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <ProductivityGauge value={focus} size={160} />
        </div>
      </div>

      {/* ── Atividade por hora ── */}
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
          <div className="empty-state" style={{ padding:'28px 0' }}>
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">Sem atividade registrada hoje ainda</div>
            <div className="empty-state-sub">Os dados aparecem assim que o agente enviar heartbeats</div>
          </div>
        ) : (
          <HourlyTimeline data={timeline} />
        )}
      </div>

      {/* ── Equipe agora — tabela estilo WorkMonitor ── */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ padding:'18px 22px 14px', borderBottom:'1px solid #e5e7eb' }}>
          <div className="section-title" style={{ marginBottom:3 }}>👥 Equipe agora</div>
          <p className="muted" style={{ fontSize:12, margin:0 }}>
            Status em tempo real via heartbeat do agente (&lt;10 min = ativo)
          </p>
        </div>

        {teamSorted.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🖥️</div>
            <div className="empty-state-title">Nenhum agente conectado ainda</div>
            <div className="empty-state-sub">
              Instale o agente desktop nos computadores dos colaboradores para ver o status em tempo real
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table" style={{ tableLayout:'fixed' }}>
              <colgroup>
                <col style={{ width:'220px' }} />
                <col style={{ width:'90px' }} />
                <col style={{ width:'100px' }} />
                <col style={{ width:'100px' }} />
                <col style={{ width:'100px' }} />
                <col style={{ width:'100px' }} />
                <col style={{ minWidth:'160px' }} />
                <col style={{ width:'80px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Status</th>
                  <th>Produtivo</th>
                  <th>Neutro</th>
                  <th>Improdutivo</th>
                  <th>Ocioso</th>
                  <th>Distribuição</th>
                  <th style={{ textAlign:'center' }}>Foco</th>
                </tr>
              </thead>
              <tbody>
                {teamSorted.map(m => {
                  const s    = statusOf(m);
                  const clr  = hashColor(m.name);
                  const tot  = m.productive + m.neutral + m.unproductive + m.idle;
                  const foco = tot > 0 ? Math.round(m.productive / (m.productive + m.neutral + m.unproductive) * 100) : 0;
                  const focoColor = foco >= 70 ? '#059669' : foco >= 50 ? '#d97706' : '#dc2626';
                  const lastLabel = m.lastSeenMin >= 60
                    ? `${Math.floor(m.lastSeenMin/60)}h atrás`
                    : m.lastSeenMin <= 0 ? 'agora'
                    : `${m.lastSeenMin}m atrás`;

                  /* barras de distribuição */
                  const pProd  = tot > 0 ? m.productive    / tot * 100 : 0;
                  const pNeut  = tot > 0 ? m.neutral        / tot * 100 : 0;
                  const pUnprod= tot > 0 ? m.unproductive   / tot * 100 : 0;
                  const pIdle  = tot > 0 ? m.idle           / tot * 100 : 0;

                  return (
                    <tr key={m.id}>
                      {/* Nome */}
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ position:'relative', flexShrink:0 }}>
                            <div style={{
                              width:36, height:36, borderRadius:'50%',
                              background:clr, color:'#fff',
                              display:'flex', alignItems:'center', justifyContent:'center',
                              fontSize:12, fontWeight:800,
                            }}>{initials(m.name)}</div>
                            <span style={{
                              position:'absolute', right:-1, bottom:-1,
                              width:11, height:11, borderRadius:'50%',
                              background:s.dot, border:'2px solid #fff',
                            }} />
                          </div>
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontWeight:600, fontSize:13, color:'#0d1117', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {m.name}
                            </div>
                            <div style={{ fontSize:11, color:'#9ca3af' }}>{lastLabel}</div>
                          </div>
                        </div>
                      </td>
                      {/* Status */}
                      <td>
                        <span style={{
                          display:'inline-flex', alignItems:'center', gap:5,
                          fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:999,
                          background:s.bg, color:s.text,
                        }}>
                          <span style={{ width:6, height:6, borderRadius:'50%', background:s.dot }} />
                          {s.label}
                        </span>
                      </td>
                      {/* Tempos */}
                      <td style={{ fontWeight:600, color:'#059669', fontSize:13 }}>
                        {tot > 0 ? formatDuration(m.productive) : '—'}
                      </td>
                      <td style={{ color:'#6b7280', fontSize:13 }}>
                        {tot > 0 ? formatDuration(m.neutral) : '—'}
                      </td>
                      <td style={{ fontWeight:600, color:'#dc2626', fontSize:13 }}>
                        {tot > 0 ? formatDuration(m.unproductive) : '—'}
                      </td>
                      <td style={{ color:'#d97706', fontSize:13 }}>
                        {tot > 0 ? formatDuration(m.idle) : '—'}
                      </td>
                      {/* Barra distribuição */}
                      <td>
                        {tot > 0 ? (
                          <div style={{ display:'flex', height:20, borderRadius:6, overflow:'hidden', gap:1 }}>
                            {pProd > 0 && (
                              <div title={`Produtivo ${Math.round(pProd)}%`} style={{
                                width:`${pProd}%`, background:'#059669',
                                display:'flex', alignItems:'center', justifyContent:'center',
                                fontSize:10, color:'#fff', fontWeight:700, minWidth:pProd>8?0:'auto',
                              }}>
                                {pProd >= 12 ? `${Math.round(pProd)}%` : ''}
                              </div>
                            )}
                            {pNeut > 0 && (
                              <div title={`Neutro ${Math.round(pNeut)}%`} style={{
                                width:`${pNeut}%`, background:'#3b82f6',
                                display:'flex', alignItems:'center', justifyContent:'center',
                                fontSize:10, color:'#fff', fontWeight:700,
                              }}>
                                {pNeut >= 12 ? `${Math.round(pNeut)}%` : ''}
                              </div>
                            )}
                            {pUnprod > 0 && (
                              <div title={`Improdutivo ${Math.round(pUnprod)}%`} style={{
                                width:`${pUnprod}%`, background:'#dc2626',
                                display:'flex', alignItems:'center', justifyContent:'center',
                                fontSize:10, color:'#fff', fontWeight:700,
                              }}>
                                {pUnprod >= 12 ? `${Math.round(pUnprod)}%` : ''}
                              </div>
                            )}
                            {pIdle > 0 && (
                              <div title={`Ocioso ${Math.round(pIdle)}%`} style={{
                                width:`${pIdle}%`, background:'#e5e7eb',
                              }} />
                            )}
                          </div>
                        ) : (
                          <span style={{ color:'#d1d5db', fontSize:12 }}>Sem dados hoje</span>
                        )}
                      </td>
                      {/* Score foco */}
                      <td style={{ textAlign:'center' }}>
                        {tot > 0 ? (
                          <div style={{
                            display:'inline-flex', flexDirection:'column', alignItems:'center', gap:2,
                          }}>
                            <span style={{ fontSize:16, fontWeight:800, color:focoColor }}>
                              {foco}%
                            </span>
                            <span style={{ fontSize:10, color:'#9ca3af', fontWeight:500 }}>foco</span>
                          </div>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Legenda */}
        {teamSorted.length > 0 && (
          <div style={{
            padding:'10px 22px', borderTop:'1px solid #f3f4f6',
            display:'flex', gap:16, flexWrap:'wrap',
          }}>
            {[
              { color:'#059669', label:'Produtivo' },
              { color:'#3b82f6', label:'Neutro' },
              { color:'#dc2626', label:'Improdutivo' },
              { color:'#e5e7eb', label:'Ocioso', text:'#9ca3af' },
            ].map(l => (
              <div key={l.label} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:l.text||'#6b7280' }}>
                <span style={{ width:12, height:12, borderRadius:3, background:l.color, display:'inline-block' }} />
                {l.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
