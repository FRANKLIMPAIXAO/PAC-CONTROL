import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import sql from '@/lib/db';
import { runRollup, dayRangeUTC } from '@/lib/rollup';

function authorized(req) {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const allowed = [process.env.DASHBOARD_API_TOKEN, process.env.CRON_SECRET].filter(Boolean);
  return allowed.includes(token);
}

export async function POST(req) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { start, end, day } = dayRangeUTC(1);

  const { users_processed } = await runRollup(start, end, day);

  // ── RETENÇÃO: 60 DIAS ──
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Limpeza de Screenshots Antigos
  const oldScreenshots = await sql`SELECT id, file_path FROM screenshot_events WHERE ts < ${sixtyDaysAgo}`;
  for (const shot of oldScreenshots) {
    if (shot.file_path) {
      await fs.unlink(shot.file_path).catch(() => {});
    }
  }
  if (oldScreenshots.length > 0) {
    const shotIds = oldScreenshots.map(s => s.id);
    await sql`DELETE FROM screenshot_events WHERE id IN ${sql(shotIds)}`;
  }

  // 2. Limpeza de Vídeos Antigos
  const oldVideos = await sql`SELECT id, file_path FROM video_events WHERE ts < ${sixtyDaysAgo}`;
  for (const vid of oldVideos) {
    if (vid.file_path) {
      await fs.unlink(vid.file_path).catch(() => {});
    }
  }
  if (oldVideos.length > 0) {
    const vidIds = oldVideos.map(v => v.id);
    await sql`DELETE FROM video_events WHERE id IN ${sql(vidIds)}`;
  }

  // 3. Limpeza de Eventos Brutos
  await sql`DELETE FROM events_raw WHERE ts < ${sixtyDaysAgo}`;

  return NextResponse.json({
    ok: true,
    day,
    users_processed,
    deleted_screenshots: oldScreenshots.length,
    deleted_videos: oldVideos.length
  });
}
