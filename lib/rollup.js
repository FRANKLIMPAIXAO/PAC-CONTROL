import sql from '@/lib/db';

function classifyEvent(e, userCompanyMap, classMap) {
  if (e.is_idle) return 'idle';

  const companyId = userCompanyMap.get(e.user_id);
  const rules = classMap.get(companyId);

  if (rules) {
    const appKey    = (e.app_name   || '').toLowerCase();
    const domainKey = (e.url_domain || '').toLowerCase();

    // Exact match on domain first (more specific)
    if (domainKey && rules.has(domainKey)) return rules.get(domainKey);

    // Contains match on app_name (e.g. "microsoft excel" matches "excel")
    for (const [key, cat] of rules) {
      if (appKey && (appKey.includes(key) || key.includes(appKey))) return cat;
    }

    // Substring match on domain for partial entries like "google.com" matching "docs.google.com"
    for (const [key, cat] of rules) {
      if (domainKey && domainKey.includes(key)) return cat;
    }
  }

  return 'neutral';
}

/**
 * Calcula e persiste as métricas diárias para um intervalo de tempo.
 * @param {string} start - ISO timestamp de início (ex: "2026-04-23T00:00:00Z")
 * @param {string} end   - ISO timestamp de fim (ex: "2026-04-24T00:00:00Z")
 * @param {string} day   - Data no formato "YYYY-MM-DD" para gravar na tabela metrics_daily
 * @returns {{ users_processed: number }}
 */
export async function runRollup(start, end, day) {
  const [events, userRows, classRows] = await Promise.all([
    sql`
      SELECT user_id, is_idle, app_name, url_domain
      FROM events_raw
      WHERE ts >= ${start} AND ts < ${end}
    `,
    sql`SELECT id, company_id FROM users`,
    sql`SELECT company_id, app_or_domain, category FROM app_classification`,
  ]);

  // Build lookup maps
  const userCompanyMap = new Map(userRows.map(u => [u.id, u.company_id]));

  const classMap = new Map();
  for (const c of classRows) {
    if (!classMap.has(c.company_id)) classMap.set(c.company_id, new Map());
    classMap.get(c.company_id).set(c.app_or_domain.toLowerCase(), c.category);
  }

  const byUser = new Map();
  for (const e of events) {
    const row = byUser.get(e.user_id) || { productive: 0, neutral: 0, unproductive: 0, idle: 0 };
    const cat = classifyEvent(e, userCompanyMap, classMap);
    if      (cat === 'idle')         row.idle         += 10;
    else if (cat === 'productive')   row.productive   += 10;
    else if (cat === 'unproductive') row.unproductive += 10;
    else                             row.neutral      += 10;
    byUser.set(e.user_id, row);
  }

  const upserts = Array.from(byUser.entries()).map(([user_id, totals]) => {
    const active = totals.productive + totals.neutral + totals.unproductive;
    const focus  = active > 0 ? (totals.productive / active) * 100 : 0;
    return {
      user_id,
      day,
      productive_sec:   totals.productive,
      neutral_sec:      totals.neutral,
      unproductive_sec: totals.unproductive,
      idle_sec:         totals.idle,
      focus_score:      Number(focus.toFixed(2)),
    };
  });

  if (upserts.length > 0) {
    await sql`
      INSERT INTO metrics_daily ${sql(upserts)}
      ON CONFLICT (user_id, day) DO UPDATE SET
        productive_sec   = EXCLUDED.productive_sec,
        neutral_sec      = EXCLUDED.neutral_sec,
        unproductive_sec = EXCLUDED.unproductive_sec,
        idle_sec         = EXCLUDED.idle_sec,
        focus_score      = EXCLUDED.focus_score
    `;
  }

  return { users_processed: upserts.length };
}

/**
 * Calcula o range UTC para N dias atrás.
 * daysAgo = 1 -> ontem
 * daysAgo = 0 -> hoje (do início do dia até agora)
 */
export function dayRangeUTC(daysAgo = 1) {
  const now    = new Date();
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo));
  const start  = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()));

  // Para hoje (daysAgo=0), o "fim" é o momento atual para capturar todos os eventos do dia
  const end = daysAgo === 0
    ? new Date()
    : new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate() + 1));

  return { start: start.toISOString(), end: end.toISOString(), day: start.toISOString().slice(0, 10) };
}
