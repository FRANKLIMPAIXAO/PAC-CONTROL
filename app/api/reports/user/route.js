import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req) {
  const store = await cookies();
  const token = store.get('wm_session')?.value;
  const session = verifySessionToken(token);
  if (!session) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const userIdParam = searchParams.get('user_id');

  const userId = session.role === 'colaborador' ? session.sub : (userIdParam || session.sub);

  let query = supabaseAdmin
    .from('metrics_daily')
    .select('day, productive_sec, neutral_sec, unproductive_sec, idle_sec')
    .eq('user_id', userId)
    .order('day', { ascending: true });

  if (from) query = query.gte('day', from);
  if (to) query = query.lte('day', to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, user_id: userId, rows: data || [] });
}
