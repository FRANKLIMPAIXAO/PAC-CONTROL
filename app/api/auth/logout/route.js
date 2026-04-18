import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set('wm_session', '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === "production",
    path: '/',
    maxAge: 0
  });
  return response;
}
