import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireSession } from '@/lib/auth-server';

const VALID_ROLES = ['admin', 'rh', 'gestor', 'colaborador'];
const VALID_STATUS = ['active', 'inactive'];

export async function GET(_req, { params }) {
  const session = await requireSession();
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
  }
  const { id } = await params;
  const [user] = await sql`
    SELECT id, name, email, role, status, team_id
    FROM users WHERE id = ${id} LIMIT 1
  `;
  if (!user) return NextResponse.json({ error: 'Usuario nao encontrado' }, { status: 404 });
  return NextResponse.json({ ok: true, user });
}

export async function PUT(req, { params }) {
  const session = await requireSession();
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const { name, email, role, team_id, status } = await req.json();

    if (!name || !email) {
      return NextResponse.json({ error: 'Nome e email sao obrigatorios' }, { status: 400 });
    }
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Nivel de acesso invalido' }, { status: 400 });
    }
    if (!VALID_STATUS.includes(status)) {
      return NextResponse.json({ error: 'Status invalido' }, { status: 400 });
    }

    // impede o admin de se auto-desativar ou remover seu proprio role de admin
    if (id === session.sub && (status === 'inactive' || role !== 'admin')) {
      return NextResponse.json({ error: 'Voce nao pode desativar ou rebaixar sua propria conta de admin' }, { status: 400 });
    }

    const emailLower = email.toLowerCase().trim();

    const [emailConflict] = await sql`
      SELECT id FROM users WHERE email = ${emailLower} AND id <> ${id} LIMIT 1
    `;
    if (emailConflict) {
      return NextResponse.json({ error: 'Ja existe outro usuario com este email' }, { status: 409 });
    }

    const [updated] = await sql`
      UPDATE users SET
        name = ${name.trim()},
        email = ${emailLower},
        role = ${role},
        team_id = ${team_id || null},
        status = ${status}
      WHERE id = ${id}
      RETURNING id, name, email, role, status, team_id
    `;

    if (!updated) return NextResponse.json({ error: 'Usuario nao encontrado' }, { status: 404 });
    return NextResponse.json({ ok: true, user: updated });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Erro inesperado' }, { status: 500 });
  }
}

// DELETE = desativa (soft). Nao apagamos registros por causa do historico de metricas.
export async function DELETE(_req, { params }) {
  const session = await requireSession();
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
  }

  const { id } = await params;
  if (id === session.sub) {
    return NextResponse.json({ error: 'Voce nao pode desativar a propria conta' }, { status: 400 });
  }

  await sql`UPDATE users SET status = 'inactive' WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
