import { requireRoles } from '@/lib/auth-server';
import sql from '@/lib/db';
import { formatDuration, pct } from '@/lib/format';
import { readFileSync } from 'fs';
import { join } from 'path';
import MetricCard from '@/app/components/metric-card';
import Avatar from '@/app/components/avatar';
import CompositionDonut from '@/app/components/charts/composition-donut';
import FocusRanking from '@/app/components/charts/focus-ranking';

const APP_TIMEZONE = 'America/Sao_Paulo';

const DEMO_ROWS = [
  { user_id: 'u1', productive_sec: 18200, neutral_sec: 4500, unproductive_sec: 1800, idle_sec: 3600, users: { name: 'Ana Paula', email: 'ana@suaempresa.com' } },
  { user_id: 'u2', productive_sec: 21600, neutral_sec: 3200, unproductive_sec: 900, idle_sec: 2700, users: { name: 'Carlos Lima', email: 'carlos@suaempresa.com' } },
  { user_id: 'u3', productive_sec: 14400, neutral_sec: 5400, unproductive_sec: 3600, idle_sec: 5400, users: { name: 'Fernanda Costa', email: 'fernanda@suaempresa.com' } },
  { user_id: 'u4', productive_sec: 25200, neutral_sec: 2700, unproductive_sec: 600, idle_sec: 1800, users: { name: 'Rafael Souza', email: 'rafael@suaempresa.com' } },
  { user_id: 'u5', productive_sec: 16200, neutral_sec: 4800, unproductive_sec: 2400, idle_sec: 4200, users: { name: 'Juliana Mendes', email: 'juliana@suaempresa.com' } },
  { user_id: 'u6', productive_sec: 19800, neutral_sec: 3900, unproductive_sec: 1200, idle_sec: 3000, users: { name: 'Marcos Andrade', email: 'marcos@suaempresa.com' } },
  { user_id: 'u7', productive_sec: 12600, neutral_sec: 6300, unproductive_sec: 4500, idle_sec: 6300, users: { name: 'Patricia Nunes', email: 'patricia@suaempresa.com' } },
  { user_id: 'u8', productive_sec: 23400, neutral_sec: 2100, unproductive_sec: 300, idle_sec: 2100, users: { name: 'Bruno Oliveira', email: 'bruno@suaempresa.com' } },
  { user_id: 'u9', productive_sec: 17100, neutral_sec: 4200, unproductive_sec: 2100, idle_sec: 4500, users: { name: 'Camila Torres', email: 'camila@suaempresa.com' } },
  { user_id: 'u10', productive_sec: 20700, neutral_sec: 3600, unproductive_sec: 1500, idle_sec: 2400, users: { name: 'Diego Ferreira', email: 'diego@suaempresa.com' } },
];

const DEMO_TOP_APPS = [
  { app_name: 'Google Chrome', events: 120, keys_total: 420, mouse_total: 388, last_seen: new Date().toISOString() },
  { app_name: 'Visual Studio Code', events: 92, keys_total: 1580, mouse_total: 240, last_seen: new Date().toISOString() },
  { app_name: 'Slack', events: 45, keys_total: 360, mouse_total: 190, last_seen: new Date().toISOString() },
  { app_name: 'Microsoft Excel', events: 30, keys_total: 250, mouse_total: 280, last_seen: new Date().toISOString() },
];

const DEMO_TOP_DOMAINS = [
  { domain: 'controle.pactarefas.com.br', events: 110, last_seen: new Date().toISOString() },
  { domain: 'docs.google.com', events: 58, last_seen: new Date().toISOString() },
  { domain: 'mail.google.com', events: 27, last_seen: new Date().toISOString() },
];

const DEMO_RECENT = [
  { ts: new Date().toISOString(), app_name: 'Google Chrome', url_domain: 'controle.pactarefas.com.br', keys_count: 18, mouse_count: 9, is_idle: false },
  { ts: new Date(Date.now() - 10000).toISOString(), app_name: 'Visual Studio Code', url_domain: null, keys_count: 22, mouse_count: 4, is_idle: false },
  { ts: new Date(Date.now() - 20000).toISOString(), app_name: 'Google Chrome', url_domain: 'docs.google.com', keys_count: 5, mouse_count: 8, is_idle: false },
];

const DEMO_HOURLY = [
  { hour: 8, keys_total: 120, mouse_total: 90, events: 18 },
  { hour: 9, keys_total: 180, mouse_total: 100, events: 22 },
  { hour: 10, keys_total: 140, mouse_total: 110, events: 20 },
  { hour: 11, keys_total: 110, mouse_total: 70, events: 14 },
];

const DEMO_SCREENSHOTS = [
  { user_id: 'u1', name: 'Ana Paula', email: 'ana@suaempresa.com', shots: 12, last_ts: new Date().toISOString() },
  { user_id: 'u2', name: 'Carlos Lima', email: 'carlos@suaempresa.com', shots: 8, last_ts: new Date(Date.now() - 60_000).toISOString() },
];

function defaultRange() {
  const to = new Date();
  const from = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function loadGoals() {
  try {
    const raw = readFileSync(join(process.cwd(), 'lib', 'goals-config.json'), 'utf-8');
    return JSON.parse(raw).periods || [];
  } catch {
    return [];
  }
}

function getActivePeriod(periods, from) {
  const day = new Date(from).getDate();
  return periods.find(p => day >= p.dayStart && day <= p.dayEnd) || periods[0];
}

function focusColor(focus, target) {
  if (focus >= target) return '#059669';
  if (focus >= target * 0.85) return '#d97706';
  return '#dc2626';
}

function formatTs(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR', { timeZone: APP_TIMEZONE });
}

export default async function ReportsPage({ searchParams }) {
  const session = await requireRoles(['admin']);
  const params = await searchParams;
  const range = defaultRange();
  const from = params?.from || range.from;
  const to = params?.to || range.to;

  const goals = loadGoals();
  const activePeriod = getActivePeriod(goals, from);

  const metricFilter = session.role === 'colaborador' ? sql`AND md.user_id = ${session.sub}` : sql``;
  const eventsFilter = session.role === 'colaborador' ? sql`AND er.user_id = ${session.sub}` : sql``;

  let data;
  let topApps;
  let topDomains;
  let recentEvents;
  let hourlyActivity;
  let interactionTotals;
  let screenshotGroups;

  if (process.env.DEMO_MODE === 'true') {
    data = DEMO_ROWS;
    topApps = DEMO_TOP_APPS;
    topDomains = DEMO_TOP_DOMAINS;
    recentEvents = DEMO_RECENT;
    hourlyActivity = DEMO_HOURLY;
    screenshotGroups = DEMO_SCREENSHOTS;
    interactionTotals = {
      keys_total: DEMO_RECENT.reduce((a, r) => a + r.keys_count, 0),
      mouse_total: DEMO_RECENT.reduce((a, r) => a + r.mouse_count, 0),
    };
  } else {
    const rowsDb = await sql`
      SELECT md.user_id, md.productive_sec, md.neutral_sec, md.unproductive_sec, md.idle_sec,
             u.name, u.email
      FROM metrics_daily md
      JOIN users u ON u.id = md.user_id
      WHERE md.day >= ${from} AND md.day <= ${to} ${metricFilter}
    `;
    data = rowsDb.map(r => ({ ...r, users: { name: r.name, email: r.email } }));

    topApps = await sql`
      SELECT COALESCE(NULLIF(er.app_name, ''), '(sem app)') AS app_name,
             COUNT(*)::int AS events,
             COALESCE(SUM(er.keys_count), 0)::int AS keys_total,
             COALESCE(SUM(er.mouse_count), 0)::int AS mouse_total,
             MAX(er.ts) AS last_seen
      FROM events_raw er
      WHERE er.ts >= ${from}::date
        AND er.ts < (${to}::date + INTERVAL '1 day')
        ${eventsFilter}
      GROUP BY 1
      ORDER BY events DESC
      LIMIT 12
    `;

    topDomains = await sql`
      SELECT er.url_domain AS domain,
             COUNT(*)::int AS events,
             MAX(er.ts) AS last_seen
      FROM events_raw er
      WHERE er.ts >= ${from}::date
        AND er.ts < (${to}::date + INTERVAL '1 day')
        AND COALESCE(er.url_domain, '') <> ''
        ${eventsFilter}
      GROUP BY er.url_domain
      ORDER BY events DESC
      LIMIT 20
    `;

    recentEvents = await sql`
      SELECT er.ts, er.app_name, er.url_domain, er.keys_count, er.mouse_count, er.is_idle
      FROM events_raw er
      WHERE er.ts >= ${from}::date
        AND er.ts < (${to}::date + INTERVAL '1 day')
        ${eventsFilter}
      ORDER BY er.ts DESC
      LIMIT 30
    `;

    hourlyActivity = await sql`
      SELECT EXTRACT(HOUR FROM (er.ts AT TIME ZONE ${APP_TIMEZONE}))::int AS hour,
             COALESCE(SUM(er.keys_count), 0)::int AS keys_total,
             COALESCE(SUM(er.mouse_count), 0)::int AS mouse_total,
             COUNT(*)::int AS events
      FROM events_raw er
      WHERE er.ts >= (date_trunc('day', (now() AT TIME ZONE ${APP_TIMEZONE})) AT TIME ZONE ${APP_TIMEZONE})
        AND er.ts < ((date_trunc('day', (now() AT TIME ZONE ${APP_TIMEZONE})) + INTERVAL '1 day') AT TIME ZONE ${APP_TIMEZONE})
        ${eventsFilter}
      GROUP BY 1
      ORDER BY 1
    `;

    const [totalRow] = await sql`
      SELECT COALESCE(SUM(er.keys_count), 0)::int AS keys_total,
             COALESCE(SUM(er.mouse_count), 0)::int AS mouse_total
      FROM events_raw er
      WHERE er.ts >= ${from}::date
        AND er.ts < (${to}::date + INTERVAL '1 day')
        ${eventsFilter}
    `;

    interactionTotals = totalRow || { keys_total: 0, mouse_total: 0 };

    try {
      screenshotGroups = await sql`
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
          ${eventsFilter}
        GROUP BY se.user_id, u.name, u.email
        ORDER BY MAX(se.ts) DESC
        LIMIT 20
      `;
    } catch {
      screenshotGroups = [];
    }
  }

  const grouped = new Map();
  for (const row of data || []) {
    const current = grouped.get(row.user_id) || {
      user_id: row.user_id,
      name: row.users?.name || 'Sem nome',
      email: row.users?.email || '-',
      productive: 0,
      neutral: 0,
      unproductive: 0,
      idle: 0,
    };
    current.productive += row.productive_sec || 0;
    current.neutral += row.neutral_sec || 0;
    current.unproductive += row.unproductive_sec || 0;
    current.idle += row.idle_sec || 0;
    grouped.set(row.user_id, current);
  }

  const rows = Array.from(grouped.values())
    .map(r => {
      const active = r.productive + r.neutral + r.unproductive;
      const focus = active > 0 ? (r.productive / active) * 100 : 0;
      return { ...r, focus };
    })
    .sort((a, b) => b.focus - a.focus);

  const target = activePeriod?.focusTarget || 70;
  const aboveMeta = rows.filter(r => r.focus >= target).length;
  const belowMeta = rows.filter(r => r.focus < target).length;

  const totals = rows.reduce(
    (acc, r) => {
      acc.productive += r.productive;
      acc.neutral += r.neutral;
      acc.unproductive += r.unproductive;
      acc.idle += r.idle;
      return acc;
    },
    { productive: 0, neutral: 0, unproductive: 0, idle: 0 }
  );

  const totalActive = totals.productive + totals.neutral + totals.unproductive;
  const avgFocus = totalActive > 0 ? (totals.productive / totalActive) * 100 : 0;

  return (
    <section className="grid" style={{ gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Analises PAC CONTROL</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Consolidado por colaborador no periodo: {from} ate {to}
          </p>
        </div>
        {activePeriod && (
          <span className="badge badge-info" style={{ fontSize: 13, padding: '6px 14px' }}>
            Periodo ativo: {activePeriod.name} (meta {activePeriod.focusTarget}%)
          </span>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <h3 style={{ margin: 0 }}>Capturas por colaborador</h3>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
            Visualizacao restrita ao admin. Clique em um bloco para abrir a galeria por usuario.
          </p>
        </div>
        {screenshotGroups.length === 0 ? (
          <div className="muted" style={{ textAlign: 'center', padding: 24 }}>
            Sem screenshots no periodo. Verifique se o agente tem permissao de Gravacao de Tela.
          </div>
        ) : (
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            {screenshotGroups.map(group => (
              <a
                key={group.user_id}
                href={`/reports/screenshots?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&user_id=${group.user_id}`}
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: 12,
                  textDecoration: 'none',
                  color: 'inherit',
                  background: '#fff',
                  padding: 12,
                }}
              >
                <div style={{ fontSize: 14, color: '#0f172a', fontWeight: 800 }}>{group.name || 'Sem nome'}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{group.email || '-'}</div>
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge">{group.shots} captura(s)</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{formatTs(group.last_ts)}</span>
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: '#1d4ed8', fontWeight: 700 }}>
                  Abrir capturas →
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-4">
        <MetricCard
          title="Foco medio"
          value={pct(avgFocus)}
          subtitle="Produtivo / ativo"
          icon="🎯"
          accent={avgFocus >= target ? 'success' : avgFocus >= target * 0.85 ? 'warning' : 'danger'}
        />
        <MetricCard
          title="Tempo produtivo"
          value={formatDuration(totals.productive)}
          subtitle={`${rows.length} colaborador(es)`}
          icon="⚡"
          accent="brand"
        />
        <MetricCard
          title="Acima da meta"
          value={`${aboveMeta}`}
          subtitle={`de ${rows.length} colaboradores`}
          icon="✓"
          accent="success"
        />
        <MetricCard
          title="Abaixo da meta"
          value={`${belowMeta}`}
          subtitle={`de ${rows.length} colaboradores`}
          icon="⚠"
          accent={belowMeta > 0 ? 'danger' : 'success'}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
        <div className="card">
          <div className="flex-between" style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Composicao do tempo</h3>
            <span className="badge">{rows.length} colaborador(es)</span>
          </div>
          <p className="muted" style={{ margin: '0 0 8px', fontSize: 13 }}>
            Soma de todos os colaboradores no periodo.
          </p>
          <CompositionDonut
            productive={totals.productive}
            neutral={totals.neutral}
            unproductive={totals.unproductive}
            idle={totals.idle}
          />
        </div>

        <div className="card">
          <div className="flex-between" style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Ranking de foco</h3>
            <span className="badge">Top {Math.min(rows.length, 10)}</span>
          </div>
          <p className="muted" style={{ margin: '0 0 8px', fontSize: 13 }}>
            Linha de referencia verde = meta do periodo ({target}%).
          </p>
          <FocusRanking rows={rows} target={target} />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <h3 style={{ margin: 0 }}>Detalhes por colaborador</h3>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
            Ordenado por foco decrescente.
          </p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Produtivo</th>
                <th>Neutro</th>
                <th>Improdutivo</th>
                <th>Ocioso</th>
                <th style={{ minWidth: 220 }}>Foco vs Meta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const color = focusColor(row.focus, target);
                const barWidth = Math.min((row.focus / target) * 100, 100);
                const status = row.focus >= target ? 'Meta atingida' : `${(target - row.focus).toFixed(1)}% abaixo`;
                return (
                  <tr key={row.user_id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={row.name} size={36} />
                        <div>
                          <strong>{row.name}</strong>
                          <div className="muted" style={{ fontSize: 12 }}>{row.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>{formatDuration(row.productive)}</td>
                    <td>{formatDuration(row.neutral)}</td>
                    <td>{formatDuration(row.unproductive)}</td>
                    <td>{formatDuration(row.idle)}</td>
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color }}>{pct(row.focus)}</span>
                        <span style={{ fontSize: 11, color }}>{status}</span>
                      </div>
                      <div style={{ height: 6, background: '#e2e8f0', borderRadius: 99, position: 'relative', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            borderRadius: 99,
                            width: `${barWidth}%`,
                            background: `linear-gradient(90deg, ${color}AA, ${color})`,
                            transition: 'width 0.4s',
                          }}
                        />
                      </div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>Meta: {target}%</div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 40 }}>
                    Sem dados para o periodo selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-4">
        <MetricCard
          title="Interacoes de teclado"
          value={`${interactionTotals.keys_total || 0}`}
          subtitle="Soma no periodo"
          icon="⌨"
          accent="info"
        />
        <MetricCard
          title="Interacoes de mouse"
          value={`${interactionTotals.mouse_total || 0}`}
          subtitle="Soma no periodo"
          icon="🖱"
          accent="neutral"
        />
        <MetricCard
          title="Apps diferentes"
          value={`${topApps.length}`}
          subtitle="Com atividade no periodo"
          icon="🧩"
          accent="brand"
        />
        <MetricCard
          title="Dominios capturados"
          value={`${topDomains.length}`}
          subtitle="Sites registrados"
          icon="🌐"
          accent={topDomains.length > 0 ? 'success' : 'warning'}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
            <h3 style={{ margin: 0 }}>Top aplicativos</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Aplicativo</th>
                  <th>Eventos</th>
                  <th>Teclado</th>
                  <th>Mouse</th>
                  <th>Ultimo uso</th>
                </tr>
              </thead>
              <tbody>
                {topApps.map(app => (
                  <tr key={app.app_name}>
                    <td>{app.app_name}</td>
                    <td>{app.events}</td>
                    <td>{app.keys_total}</td>
                    <td>{app.mouse_total}</td>
                    <td>{formatTs(app.last_seen)}</td>
                  </tr>
                ))}
                {topApps.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 20 }}>
                      Sem dados de aplicativos no periodo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
            <h3 style={{ margin: 0 }}>Top sites/dominios</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Dominio</th>
                  <th>Eventos</th>
                  <th>Ultimo acesso</th>
                </tr>
              </thead>
              <tbody>
                {topDomains.map(site => (
                  <tr key={site.domain}>
                    <td>{site.domain}</td>
                    <td>{site.events}</td>
                    <td>{formatTs(site.last_seen)}</td>
                  </tr>
                ))}
                {topDomains.length === 0 && (
                  <tr>
                    <td colSpan={3} className="muted" style={{ textAlign: 'center', padding: 20 }}>
                      Ainda sem dominios capturados. Para listar sites, o agente precisa preencher url_domain.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
            <h3 style={{ margin: 0 }}>Atividade por hora (hoje)</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Teclado</th>
                  <th>Mouse</th>
                  <th>Eventos</th>
                </tr>
              </thead>
              <tbody>
                {hourlyActivity.map(h => (
                  <tr key={h.hour}>
                    <td>{String(h.hour).padStart(2, '0')}:00</td>
                    <td>{h.keys_total}</td>
                    <td>{h.mouse_total}</td>
                    <td>{h.events}</td>
                  </tr>
                ))}
                {hourlyActivity.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 20 }}>
                      Sem eventos hoje.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
            <h3 style={{ margin: 0 }}>Eventos recentes</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>App</th>
                  <th>Site</th>
                  <th>Teclado</th>
                  <th>Mouse</th>
                  <th>Idle</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((ev, idx) => (
                  <tr key={`${ev.ts}-${idx}`}>
                    <td>{formatTs(ev.ts)}</td>
                    <td>{ev.app_name || '-'}</td>
                    <td>{ev.url_domain || '-'}</td>
                    <td>{ev.keys_count || 0}</td>
                    <td>{ev.mouse_count || 0}</td>
                    <td>{ev.is_idle ? 'Sim' : 'Nao'}</td>
                  </tr>
                ))}
                {recentEvents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 20 }}>
                      Sem eventos recentes no periodo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
