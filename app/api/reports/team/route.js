import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/session';
import sql from '@/lib/db';

export async function GET(req) {
  const store = await cookies();
  const token = store.get('wm_session')?.value;
  const session = verifySessionToken(token);

  if (!session) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  if (!['admin', 'gestor', 'rh'].includes(session.role)) {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from   = searchParams.get('from') || '2000-01-01';
  const to     = searchParams.get('to')   || '2099-12-31';
  const teamId = searchParams.get('team_id');

  let data;
  if (teamId) {
    data = await sql`
      SELECT md.user_id, md.day,
             md.productive_sec, md.neutral_sec, md.unproductive_sec, md.idle_sec,
             u.team_id, u.name, u.email
      FROM metrics_daily md
      JOIN users u ON u.id = md.user_id
      WHERE md.day >= ${from} AND md.day <= ${to}
        AND u.team_id = ${teamId}
      ORDER BY md.day ASC
    `;
  } else {
    data = await sql`
      SELECT md.user_id, md.day,
             md.productive_sec, md.neutral_sec, md.unproductive_sec, md.idle_sec,
             u.team_id, u.name, u.email
      FROM metrics_daily md
      JOIN users u ON u.id = md.user_id
      WHERE md.day >= ${from} AND md.day <= ${to}
      ORDER BY md.day ASC
    `;
  }

  return NextResponse.json({ ok: true, team_id: teamId || null, rows: data });
}
