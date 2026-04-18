import { NextResponse } from 'next/server';
import sql from '@/lib/db';

function authorized(req) {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return Boolean(process.env.AGENT_BOOTSTRAP_TOKEN) && token === process.env.AGENT_BOOTSTRAP_TOKEN;
}

export async function POST(req) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { user_id, hostname, os, agent_version } = await req.json();
  if (!user_id || !hostname || !os) {
    return NextResponse.json({ error: 'user_id, hostname and os are required' }, { status: 400 });
  }

  const version = agent_version || '0.1.0';

  const [device] = await sql`
    INSERT INTO devices (user_id, hostname, os, agent_version, last_seen_at, is_active)
    VALUES (${user_id}, ${hostname}, ${os}, ${version}, NOW(), true)
    ON CONFLICT (user_id, hostname) DO UPDATE SET
      os            = EXCLUDED.os,
      agent_version = EXCLUDED.agent_version,
      last_seen_at  = NOW(),
      is_active     = true
    RETURNING id, user_id, hostname, os, agent_version, last_seen_at
  `;

  return NextResponse.json({ ok: true, device });
}
