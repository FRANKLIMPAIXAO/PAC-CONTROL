import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/session';

export async function GET() {
  const store = await cookies();
  const token = store.get('wm_session')?.value;
  const session = verifySessionToken(token);

  if (!session) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  return NextResponse.json({ user: session });
}
