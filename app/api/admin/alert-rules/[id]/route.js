import { NextResponse } from 'next/server';
import sql from '@/lib/db';

async function getCompanyId(req) {
  const h = req.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!token) return null;
  const rows = await sql`
    SELECT u.company_id FROM users u
    WHERE u.session_token = ${token} AND u.status = 'active'
    LIMIT 1
  `;
  return rows[0]?.company_id || null;
}

export async function PATCH(req, { params }) {
  const companyId = await getCompanyId(req);
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;
  const body = await req.json();
  const { enabled } = body;

  const [rule] = await sql`
    UPDATE alert_rules
    SET enabled = ${Boolean(enabled)}
    WHERE id = ${id} AND company_id = ${companyId}
    RETURNING id, name, type, threshold, enabled, notify_email, created_at
  `;

  if (!rule) return NextResponse.json({ error: 'Regra nao encontrada' }, { status: 404 });
  return NextResponse.json({ rule });
}

export async function DELETE(req, { params }) {
  const companyId = await getCompanyId(req);
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;
  const result = await sql`
    DELETE FROM alert_rules
    WHERE id = ${id} AND company_id = ${companyId}
    RETURNING id
  `;

  if (!result.length) return NextResponse.json({ error: 'Regra nao encontrada' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
