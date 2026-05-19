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

export async function GET(req) {
  const companyId = await getCompanyId(req);
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rules = await sql`
    SELECT id, name, type, threshold, enabled, notify_email, created_at
    FROM alert_rules
    WHERE company_id = ${companyId}
    ORDER BY created_at DESC
  `;
  return NextResponse.json({ rules });
}

export async function POST(req) {
  const companyId = await getCompanyId(req);
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, type, threshold, enabled = true, notify_email = true } = body;

  if (!name || !type || threshold == null) {
    return NextResponse.json({ error: 'name, type e threshold sao obrigatorios' }, { status: 400 });
  }

  const validTypes = ['idle_too_long', 'below_focus', 'unproductive_site', 'offline_too_long'];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: 'Tipo invalido' }, { status: 400 });
  }

  const [rule] = await sql`
    INSERT INTO alert_rules (company_id, name, type, threshold, enabled, notify_email)
    VALUES (${companyId}, ${name}, ${type}, ${Number(threshold)}, ${Boolean(enabled)}, ${Boolean(notify_email)})
    RETURNING id, name, type, threshold, enabled, notify_email, created_at
  `;
  return NextResponse.json({ rule }, { status: 201 });
}
