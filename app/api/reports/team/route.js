import { requireRoles } from '@/lib/auth-server';
import sql from '@/lib/db';

export async function GET(req) {
  const session = await requireRoles(['admin', 'manager', 'gestor', 'rh']);
  const company_id = session.company_id;

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
        AND u.company_id = ${company_id}
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
        AND u.company_id = ${company_id}
      ORDER BY md.day ASC
    `;
  }

  return Response.json({ ok: true, team_id: teamId || null, rows: data });
}
