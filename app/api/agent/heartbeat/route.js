import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDeviceExists } from '@/lib/agent-security';

function authorized(req) {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return Boolean(process.env.AGENT_BOOTSTRAP_TOKEN) && token === process.env.AGENT_BOOTSTRAP_TOKEN;
}

export async function POST(req) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { device_id, is_idle } = await req.json();
  if (!device_id) return NextResponse.json({ error: 'device_id is required' }, { status: 400 });

  const device = await ensureDeviceExists(device_id);
  if (!device) return NextResponse.json({ error: 'device_id invalido' }, { status: 404 });

  await sql`
    UPDATE devices SET
      last_seen_at     = NOW(),
      last_idle_state  = ${Boolean(is_idle)},
      is_active        = true
    WHERE id = ${device_id}
  `;

  return NextResponse.json({ ok: true });
}
