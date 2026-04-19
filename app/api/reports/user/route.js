import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/session';
import sql from '@/lib/db';

export async function GET(req) {
  const store = await cookies();
  const token = store.get('wm_session')?.value;
  const session = verifySessionToken(token);
  if (!session) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from        = searchParams.get('from') || '2000-01-01';
  const to          = searchParams.get('to')   || '2099-12-31';
  const userIdParam = searchParams.get('user_id');

  const userId = session.role === 'colaborador' ? session.sub : (userIdParam || session.sub);

  const data = await sql`
    SELECT day, productive_sec, neutral_sec, unproductive_sec, idle_sec
    FROM metrics_daily
    WHERE user_id = ${userId}
      AND day >= ${from}
      AND day <= ${to}
    ORDER BY day ASC
  `;

  return NextResponse.json({ ok: true, user_id: userId, rows: data });
}
