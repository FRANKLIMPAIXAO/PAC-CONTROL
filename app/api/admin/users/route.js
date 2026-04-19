import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import sql from '@/lib/db';
import { requireSession } from '@/lib/auth-server';

const VALID_ROLES = ['admin', 'rh', 'gestor', 'colaborador'];

export async function GET() {
  const session = await requireSession();
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
  }

  const rows = await sql`
    SELECT u.id, u.name, u.email, u.role, u.status, u.team_id, u.created_at,
           t.name AS team_name
    FROM users u
    LEFT JOIN teams t ON t.id = u.team_id
    ORDER BY u.created_at DESC
  `;

  return NextResponse.json({ ok: true, users: rows });
}

export async function POST(req) {
  const session = await requireSession();
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
  }

  try {
    const { name, email, role, team_id, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Nome, email e senha sao obrigatorios' }, { status: 400 });
    }
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Nivel de acesso invalido' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'A senha precisa ter pelo menos 8 caracteres' }, { status: 400 });
    }

    const emailLower = email.toLowerCase().trim();

    const [existing] = await sql`SELECT id FROM users WHERE email = ${emailLower} LIMIT 1`;
    if (existing) {
      return NextResponse.json({ error: 'Ja existe um usuario com este email' }, { status: 409 });
    }

    // Pega company_id do admin que esta criando
    const [admin] = await sql`SELECT company_id FROM users WHERE id = ${session.sub} LIMIT 1`;
    if (!admin) {
      return NextResponse.json({ error: 'Admin nao encontrado' }, { status: 500 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [created] = await sql`
      INSERT INTO users (id, company_id, team_id, name, email, role, status, password_hash)
      VALUES (
        gen_random_uuid(),
        ${admin.company_id},
        ${team_id || null},
        ${name.trim()},
        ${emailLower},
        ${role},
        'active',
        ${passwordHash}
      )
      RETURNING id, name, email, role, status, team_id
    `;

    return NextResponse.json({ ok: true, user: created });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Erro inesperado' }, { status: 500 });
  }
}
