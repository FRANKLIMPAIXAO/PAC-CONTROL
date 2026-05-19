import { requireRoles } from '@/lib/auth-server';
import sql from '@/lib/db';

export async function GET() {
  try {
    const session = await requireRoles(['admin', 'manager']);

    const rows = await sql`
      SELECT DISTINCT ON (se.user_id)
             se.user_id,
             u.name,
             u.email,
             se.id         AS screenshot_id,
             se.ts         AS last_ts,
             se.app_name,
             se.url_domain,
             se.is_idle
      FROM screenshot_events se
      JOIN users u ON u.id = se.user_id
      WHERE u.company_id = ${session.company_id}
        AND u.status = 'active'
      ORDER BY se.user_id, se.ts DESC
    `;

    return Response.json({ ok: true, users: rows });
  } catch (err) {
    const msg = err?.message || String(err);
    // se for redirect do Next.js, deixa propagar
    if (msg.includes('NEXT_REDIRECT')) throw err;
    console.error('[mosaic/latest]', msg);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
