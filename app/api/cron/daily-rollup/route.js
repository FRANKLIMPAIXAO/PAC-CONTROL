import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import sql from '@/lib/db';

function authorized(req) {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const allowed = [process.env.DASHBOARD_API_TOKEN, process.env.CRON_SECRET].filter(Boolean);
  return allowed.includes(token);
}

function dayRangeUTC(daysAgo = 1) {
  const now    = new Date();
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo));
  const start  = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()));
  const end    = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate() + 1));
  return { start: start.toISOString(), end: end.toISOString(), day: start.toISOString().slice(0, 10) };
}

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

export async function POST(req) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { start, end, day } = dayRangeUTC(1);

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

  // ── RETENÇÃO: 60 DIAS ──
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Limpeza de Screenshots Antigos
  const oldScreenshots = await sql`SELECT id, file_path FROM screenshot_events WHERE ts < ${sixtyDaysAgo}`;
  for (const shot of oldScreenshots) {
    if (shot.file_path) {
      await fs.unlink(shot.file_path).catch(() => {}); // Ignora se o arquivo já não existir
    }
  }
  if (oldScreenshots.length > 0) {
    const shotIds = oldScreenshots.map(s => s.id);
    await sql`DELETE FROM screenshot_events WHERE id IN ${sql(shotIds)}`;
  }

  // 2. Limpeza de Vídeos Antigos
  const oldVideos = await sql`SELECT id, file_path FROM video_events WHERE ts < ${sixtyDaysAgo}`;
  for (const vid of oldVideos) {
    if (vid.file_path) {
      await fs.unlink(vid.file_path).catch(() => {});
    }
  }
  if (oldVideos.length > 0) {
    const vidIds = oldVideos.map(v => v.id);
    await sql`DELETE FROM video_events WHERE id IN ${sql(vidIds)}`;
  }

  // 3. Limpeza de Eventos Brutos
  await sql`DELETE FROM events_raw WHERE ts < ${sixtyDaysAgo}`;

  return NextResponse.json({
    ok: true,
    day,
    users_processed: upserts.length,
    deleted_screenshots: oldScreenshots.length,
    deleted_videos: oldVideos.length
  });
}
