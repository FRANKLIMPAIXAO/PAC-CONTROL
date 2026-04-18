import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/session';
import sql from '@/lib/db';

export async function GET(req) {
  const store   = await cookies();
  const token   = store.get('wm_session')?.value;
  const session = verifySessionToken(token);

  if (!session) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from   = searchParams.get('from') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to     = searchParams.get('to')   || new Date().toISOString().slice(0, 10);
  const teamId = searchParams.get('team_id');

  let data;
  if (session.role === 'colaborador') {
    data = await sql`
      SELECT md.user_id, md.day,
             md.productive_sec, md.neutral_sec, md.unproductive_sec, md.idle_sec,
             u.team_id, u.name
      FROM metrics_daily md
      JOIN users u ON u.id = md.user_id
      WHERE md.day >= ${from} AND md.day <= ${to}
        AND md.user_id = ${session.sub}
    `;
  } else if (teamId) {
    data = await sql`
      SELECT md.user_id, md.day,
             md.productive_sec, md.neutral_sec, md.unproductive_sec, md.idle_sec,
             u.team_id, u.name
      FROM metrics_daily md
      JOIN users u ON u.id = md.user_id
      WHERE md.day >= ${from} AND md.day <= ${to}
        AND u.team_id = ${teamId}
    `;
  } else {
    data = await sql`
      SELECT md.user_id, md.day,
             md.productive_sec, md.neutral_sec, md.unproductive_sec, md.idle_sec,
             u.team_id, u.name
      FROM metrics_daily md
      JOIN users u ON u.id = md.user_id
      WHERE md.day >= ${from} AND md.day <= ${to}
    `;
  }

  const totals = { productive_sec: 0, neutral_sec: 0, unproductive_sec: 0, idle_sec: 0 };
  for (const row of data) {
    totals.productive_sec   += row.productive_sec   || 0;
    totals.neutral_sec      += row.neutral_sec      || 0;
    totals.unproductive_sec += row.unproductive_sec || 0;
    totals.idle_sec         += row.idle_sec         || 0;
  }

  return NextResponse.json({ ok: true, filters: { from, to, team_id: teamId || null }, totals, rows: data });
}
