import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import sql from '@/lib/db';
import { createSessionToken } from '@/lib/session';

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha sao obrigatorios' }, { status: 400 });
    }

    const [user] = await sql`
      SELECT id, name, email, role, status, password_hash
      FROM users
      WHERE email = ${email.toLowerCase()}
      LIMIT 1
    `;

    if (!user || user.status !== 'active' || !user.password_hash) {
      return NextResponse.json({ error: 'Credenciais invalidas' }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return NextResponse.json({ error: 'Credenciais invalidas' }, { status: 401 });

    const token = createSessionToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set('wm_session', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 24 * 60 * 60
    });

    return response;
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Erro inesperado' }, { status: 500 });
  }
}
