import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDeviceBelongsToUser } from '@/lib/agent-security';

const MAX_BATCH = 300;

function authorized(req) {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return Boolean(process.env.AGENT_BOOTSTRAP_TOKEN) && token === process.env.AGENT_BOOTSTRAP_TOKEN;
}

export async function POST(req) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { device_id, user_id, events } = await req.json();

  if (!device_id || !user_id || !Array.isArray(events)) {
    return NextResponse.json({ error: 'device_id, user_id and events[] are required' }, { status: 400 });
  }

  if (events.length === 0) return NextResponse.json({ ok: true, inserted: 0 });
  if (events.length > MAX_BATCH) {
    return NextResponse.json({ error: `Batch too large. Max ${MAX_BATCH}` }, { status: 400 });
  }

  const device = await ensureDeviceBelongsToUser(device_id, user_id);
  if (!device) {
    return NextResponse.json({ error: 'device_id nao pertence ao user_id informado' }, { status: 403 });
  }

  const now = new Date().toISOString();
  const rows = events.map(e => ({
    device_id,
    user_id,
    ts:           e.ts          || now,
    event_type:   e.event_type  || 'activity',
    app_name:     e.app_name    || null,
    url_domain:   e.url_domain  || null,
    window_hash:  e.window_hash || null,
    is_idle:      Boolean(e.is_idle),
    keys_count:   Number(e.keys_count  || 0),
    mouse_count:  Number(e.mouse_count || 0),
    payload_json: JSON.stringify(e.payload_json || {}),
  }));

  await sql`INSERT INTO events_raw ${sql(rows)}`;

  return NextResponse.json({ ok: true, inserted: rows.length });
}
