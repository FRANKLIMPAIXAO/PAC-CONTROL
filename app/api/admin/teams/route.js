import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireSession } from '@/lib/auth-server';

export async function GET() {
  const session = await requireSession();
  if (!['admin', 'rh', 'gestor'].includes(session.role)) {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
  }

  const rows = await sql`
    SELECT t.id, t.name, t.created_at,
           (SELECT COUNT(*) FROM users u WHERE u.team_id = t.id AND u.status = 'active')::int AS member_count
    FROM teams t
    ORDER BY t.name ASC
  `;

  return NextResponse.json({ ok: true, teams: rows });
}

export async function POST(req) {
  const session = await requireSession();
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
  }

  try {
    const { name } = await req.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nome do time e obrigatorio' }, { status: 400 });
    }

    const [admin] = await sql`SELECT company_id FROM users WHERE id = ${session.sub} LIMIT 1`;
    if (!admin) return NextResponse.json({ error: 'Admin nao encontrado' }, { status: 500 });

    const [created] = await sql`
      INSERT INTO teams (id, company_id, name)
      VALUES (gen_random_uuid(), ${admin.company_id}, ${name.trim()})
      RETURNING id, name, created_at
    `;
    return NextResponse.json({ ok: true, team: created });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Erro inesperado' }, { status: 500 });
  }
}
