import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import sql from '@/lib/db';
import { requireSession } from '@/lib/auth-server';

export async function POST(req, { params }) {
  const session = await requireSession();
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const { newPassword } = await req.json();

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: 'A senha precisa ter pelo menos 8 caracteres' }, { status: 400 });
    }

    const [user] = await sql`SELECT id FROM users WHERE id = ${id} LIMIT 1`;
    if (!user) return NextResponse.json({ error: 'Usuario nao encontrado' }, { status: 404 });

    const hash = await bcrypt.hash(newPassword, 10);
    await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${id}`;

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Erro inesperado' }, { status: 500 });
  }
}
