import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireRoles } from '@/lib/auth-server';

export async function GET() {
  const session = await requireRoles(['admin']);

  const rules = await sql`
    SELECT id, name, type, threshold, enabled, notify_email, created_at
    FROM alert_rules
    WHERE company_id = ${session.company_id}
    ORDER BY created_at DESC
  `;
  return NextResponse.json({ rules });
}

export async function POST(req) {
  const session = await requireRoles(['admin']);

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
    VALUES (${session.company_id}, ${name}, ${type}, ${Number(threshold)}, ${Boolean(enabled)}, ${Boolean(notify_email)})
    RETURNING id, name, type, threshold, enabled, notify_email, created_at
  `;
  return NextResponse.json({ rule }, { status: 201 });
}
