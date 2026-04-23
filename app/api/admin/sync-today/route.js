import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth-server';
import { runRollup, dayRangeUTC } from '@/lib/rollup';

export async function POST() {
  const session = await getCurrentSession();

  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });
  }

  try {
    // Sincroniza os dados de HOJE (daysAgo = 0)
    const { start, end, day } = dayRangeUTC(0);
    const { users_processed } = await runRollup(start, end, day);

    return NextResponse.json({ ok: true, day, users_processed });
  } catch (err) {
    console.error('[sync-today]', err);
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
