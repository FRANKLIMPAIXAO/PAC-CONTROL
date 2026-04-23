import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import sql from '@/lib/db';
import { createSessionToken } from '@/lib/session';
import { resetRateLimit, takeRateLimit } from '@/lib/rate-limit';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMIT_PER_IP = 20;
const LOGIN_LIMIT_PER_EMAIL_IP = 5;

function getClientIp(req) {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha sao obrigatorios' }, { status: 400 });
    }

    const emailLower = email.toLowerCase().trim();
    const clientIp = getClientIp(req);

    const ipLimit = takeRateLimit(`login:ip:${clientIp}`, LOGIN_LIMIT_PER_IP, LOGIN_WINDOW_MS);
    const credentialLimit = takeRateLimit(`login:email-ip:${emailLower}:${clientIp}`, LOGIN_LIMIT_PER_EMAIL_IP, LOGIN_WINDOW_MS);

    if (!ipLimit.allowed || !credentialLimit.allowed) {
      const retryAfter = Math.max(ipLimit.retryAfterSec, credentialLimit.retryAfterSec);
      return NextResponse.json(
        { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        }
      );
    }

    const [user] = await sql`
      SELECT id, name, email, role, status, password_hash
      FROM users
      WHERE email = ${emailLower}
      LIMIT 1
    `;

    if (!user || user.status !== 'active' || !user.password_hash) {
      return NextResponse.json({ error: 'Credenciais invalidas' }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return NextResponse.json({ error: 'Credenciais invalidas' }, { status: 401 });

    resetRateLimit(`login:email-ip:${emailLower}:${clientIp}`);

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
