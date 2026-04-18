import { NextResponse } from 'next/server';
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

export async function POST(req) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { start, end, day } = dayRangeUTC(1);

  const events = await sql`
    SELECT user_id, is_idle, app_name, url_domain
    FROM events_raw
    WHERE ts >= ${start} AND ts < ${end}
  `;

  const byUser = new Map();
  for (const e of events) {
    const row = byUser.get(e.user_id) || { productive: 0, neutral: 0, unproductive: 0, idle: 0 };
    if (e.is_idle) {
      row.idle += 10;
    } else if (
      (e.app_name    || '').toLowerCase().includes('excel') ||
      (e.url_domain  || '').includes('docs.google.com')
    ) {
      row.productive += 10;
    } else {
      row.neutral += 10;
    }
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

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  await sql`DELETE FROM events_raw WHERE ts < ${ninetyDaysAgo}`;

  return NextResponse.json({ ok: true, day, users_processed: upserts.length });
}
