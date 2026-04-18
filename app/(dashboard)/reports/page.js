import { requireSession } from '@/lib/auth-server';
import sql from '@/lib/db';
import { formatDuration, pct } from '@/lib/format';
import { readFileSync } from 'fs';
import { join } from 'path';

// ── Demo data ─────────────────────────────────────────────────────────────────

const DEMO_ROWS = [
  { user_id: 'u1',  productive_sec: 18200, neutral_sec: 4500, unproductive_sec: 1800, idle_sec: 3600, users: { name: 'Ana Paula',      email: 'ana@suaempresa.com'      } },
  { user_id: 'u2',  productive_sec: 21600, neutral_sec: 3200, unproductive_sec: 900,  idle_sec: 2700, users: { name: 'Carlos Lima',    email: 'carlos@suaempresa.com'   } },
  { user_id: 'u3',  productive_sec: 14400, neutral_sec: 5400, unproductive_sec: 3600, idle_sec: 5400, users: { name: 'Fernanda Costa', email: 'fernanda@suaempresa.com' } },
  { user_id: 'u4',  productive_sec: 25200, neutral_sec: 2700, unproductive_sec: 600,  idle_sec: 1800, users: { name: 'Rafael Souza',   email: 'rafael@suaempresa.com'   } },
  { user_id: 'u5',  productive_sec: 16200, neutral_sec: 4800, unproductive_sec: 2400, idle_sec: 4200, users: { name: 'Juliana Mendes', email: 'juliana@suaempresa.com'  } },
  { user_id: 'u6',  productive_sec: 19800, neutral_sec: 3900, unproductive_sec: 1200, idle_sec: 3000, users: { name: 'Marcos Andrade', email: 'marcos@suaempresa.com'   } },
  { user_id: 'u7',  productive_sec: 12600, neutral_sec: 6300, unproductive_sec: 4500, idle_sec: 6300, users: { name: 'Patricia Nunes', email: 'patricia@suaempresa.com' } },
  { user_id: 'u8',  productive_sec: 23400, neutral_sec: 2100, unproductive_sec: 300,  idle_sec: 2100, users: { name: 'Bruno Oliveira', email: 'bruno@suaempresa.com'    } },
  { user_id: 'u9',  productive_sec: 17100, neutral_sec: 4200, unproductive_sec: 2100, idle_sec: 4500, users: { name: 'Camila Torres',  email: 'camila@suaempresa.com'   } },
  { user_id: 'u10', productive_sec: 20700, neutral_sec: 3600, unproductive_sec: 1500, idle_sec: 2400, users: { name: 'Diego Ferreira', email: 'diego@suaempresa.com'    } },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultRange() {
  const to   = new Date();
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
  if (focus >= target)          return '#059669'; // verde
  if (focus >= target * 0.85)   return '#d97706'; // amarelo
  return '#dc2626';                               // vermelho
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ReportsPage({ searchParams }) {
  const session = await requireSession();
  const params  = await searchParams;
  const range   = defaultRange();
  const from    = params?.from || range.from;
  const to      = params?.to   || range.to;

  const goals        = loadGoals();
  const activePeriod = getActivePeriod(goals, from);

  let data;
  if (process.env.DEMO_MODE === 'true') {
    data = DEMO_ROWS;
  } else {
    const filter = session.role === 'colaborador' ? sql`AND md.user_id = ${session.sub}` : sql``;
    const rows = await sql`
      SELECT md.user_id, md.productive_sec, md.neutral_sec, md.unproductive_sec, md.idle_sec,
             u.name, u.email
      FROM metrics_daily md
      JOIN users u ON u.id = md.user_id
      WHERE md.day >= ${from} AND md.day <= ${to} ${filter}
    `;
    data = rows.map(r => ({
      ...r,
      users: { name: r.name, email: r.email }
    }));
  }

  const grouped = new Map();
  for (const row of data || []) {
    const current = grouped.get(row.user_id) || {
      user_id: row.user_id,
      name:  row.users?.name  || 'Sem nome',
      email: row.users?.email || '-',
      productive: 0, neutral: 0, unproductive: 0, idle: 0,
    };
    current.productive   += row.productive_sec   || 0;
    current.neutral      += row.neutral_sec      || 0;
    current.unproductive += row.unproductive_sec || 0;
    current.idle         += row.idle_sec         || 0;
    grouped.set(row.user_id, current);
  }

  const rows = Array.from(grouped.values()).map(r => {
    const active = r.productive + r.neutral + r.unproductive;
    const focus  = active > 0 ? (r.productive / active) * 100 : 0;
    return { ...r, focus };
  }).sort((a, b) => b.focus - a.focus);

  const target    = activePeriod?.focusTarget || 70;
  const aboveMeta = rows.filter(r => r.focus >= target).length;
  const belowMeta = rows.filter(r => r.focus < target).length;

  return (
    <section className="grid" style={{ gap: 20 }}>

      {/* ── Header ── */}
      <div className="card">
        <h1 style={{ margin: 0 }}>Analises PAC CONTROL</h1>
        <p className="muted" style={{ marginBottom: 0 }}>
          Consolidado por colaborador no periodo: {from} ate {to}
        </p>
      </div>

      {/* ── Período ativo ── */}
      {activePeriod && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div className="card" style={{ borderTop: '3px solid #0f766e' }}>
            <div className="muted" style={{ fontSize: 13 }}>Período ativo</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{activePeriod.name}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{activePeriod.description}</div>
          </div>
          <div className="card" style={{ borderTop: '3px solid #0f766e' }}>
            <div className="muted" style={{ fontSize: 13 }}>Meta de foco</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{activePeriod.focusTarget}%</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Dias {activePeriod.dayStart}–{activePeriod.dayEnd} do mês</div>
          </div>
          <div className="card" style={{ borderTop: '3px solid #059669' }}>
            <div className="muted" style={{ fontSize: 13 }}>Acima da meta</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: '#059669' }}>{aboveMeta} colaboradores</div>
          </div>
          <div className="card" style={{ borderTop: `3px solid ${belowMeta > 0 ? '#dc2626' : '#059669'}` }}>
            <div className="muted" style={{ fontSize: 13 }}>Abaixo da meta</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: belowMeta > 0 ? '#dc2626' : '#059669' }}>
              {belowMeta} colaboradores
            </div>
          </div>
        </div>
      )}

      {/* ── Tabela ── */}
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Produtivo</th>
              <th>Neutro</th>
              <th>Improdutivo</th>
              <th>Ocioso</th>
              <th style={{ minWidth: 180 }}>Foco vs Meta</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const color    = focusColor(row.focus, target);
              const barWidth = Math.min((row.focus / target) * 100, 100);
              const status   = row.focus >= target ? '✓ Meta' : `${(target - row.focus).toFixed(1)}% abaixo`;
              return (
                <tr key={row.user_id}>
                  <td>
                    <strong>{row.name}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>{row.email}</div>
                  </td>
                  <td>{formatDuration(row.productive)}</td>
                  <td>{formatDuration(row.neutral)}</td>
                  <td>{formatDuration(row.unproductive)}</td>
                  <td>{formatDuration(row.idle)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color }}>{pct(row.focus)}</span>
                          <span style={{ fontSize: 11, color }} className="muted">{status}</span>
                        </div>
                        <div style={{ height: 6, background: '#e5e7eb', borderRadius: 99, position: 'relative' }}>
                          {/* Linha de meta */}
                          <div style={{
                            position: 'absolute', left: '100%', top: -3,
                            width: 1, height: 12, background: '#6b7280', opacity: 0.4
                          }} />
                          <div style={{
                            height: '100%', borderRadius: 99,
                            width: `${barWidth}%`,
                            background: color,
                            transition: 'width 0.4s'
                          }} />
                        </div>
                        <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
                          Meta: {target}%
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">Sem dados para o periodo.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </section>
  );
}
