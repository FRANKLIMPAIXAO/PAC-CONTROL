import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req) {
  const store = await cookies();
  const token = store.get('wm_session')?.value;
  const session = verifySessionToken(token);

  if (!session) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  if (!['admin', 'gestor', 'rh'].includes(session.role)) {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const teamId = searchParams.get('team_id');

  let query = supabaseAdmin
    .from('metrics_daily')
    .select('user_id, day, productive_sec, neutral_sec, unproductive_sec, idle_sec, users!inner(team_id,name,email)')
    .order('day', { ascending: true });

  if (from) query = query.gte('day', from);
  if (to) query = query.lte('day', to);
  if (teamId) query = query.eq('users.team_id', teamId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, team_id: teamId, rows: data || [] });
}
