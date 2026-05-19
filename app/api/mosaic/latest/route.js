import { requireRoles } from '@/lib/auth-server';
import sql from '@/lib/db';

export async function GET() {
  const session = await requireRoles(['admin', 'manager']);

  const rows = await sql`
    SELECT DISTINCT ON (se.user_id)
           se.user_id,
           u.name,
           u.email,
           se.id         AS screenshot_id,
           se.ts         AS last_ts,
           er.app_name,
           er.url_domain,
           er.is_idle
    FROM screenshot_events se
    JOIN users u ON u.id = se.user_id
    LEFT JOIN LATERAL (
      SELECT app_name, url_domain, is_idle
      FROM events_raw
      WHERE user_id = se.user_id
      ORDER BY ts DESC
      LIMIT 1
    ) er ON true
    WHERE u.company_id = ${session.company_id}
      AND u.status = 'active'
    ORDER BY se.user_id, se.ts DESC
  `;

  return Response.json({ ok: true, users: rows });
}
