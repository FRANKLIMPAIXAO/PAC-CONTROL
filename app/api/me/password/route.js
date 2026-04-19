import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import sql from '@/lib/db';
import { requireSession } from '@/lib/auth-server';

export async function POST(req) {
  try {
    const session = await requireSession();
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Informe a senha atual e a nova senha' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'A nova senha precisa ter pelo menos 8 caracteres' }, { status: 400 });
    }

    const [user] = await sql`
      SELECT password_hash FROM users WHERE id = ${session.sub} LIMIT 1
    `;

    if (!user || !user.password_hash) {
      return NextResponse.json({ error: 'Usuario nao encontrado' }, { status: 404 });
    }

    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) {
      return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 401 });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await sql`UPDATE users SET password_hash = ${newHash} WHERE id = ${session.sub}`;

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Erro inesperado' }, { status: 500 });
  }
}
