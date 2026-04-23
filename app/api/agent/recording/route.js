import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import sql from '@/lib/db';
import { ensureDeviceBelongsToUser } from '@/lib/agent-security';

const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB

function authorized(req) {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return Boolean(process.env.AGENT_BOOTSTRAP_TOKEN) && token === process.env.AGENT_BOOTSTRAP_TOKEN;
}

function safeSegment(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'unknown';
}

function stripDataPrefix(base64) {
  if (!base64) return '';
  const str = String(base64);
  const match = str.match(/^data:video\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
  return match ? match[1] : str;
}

export async function POST(req) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const {
      device_id,
      user_id,
      ts,
      app_name,
      url_domain,
      is_idle,
      video_base64,
      mime_type,
      width,
      height,
      duration_sec,
      fps,
    } = body;

    if (!device_id || !user_id || !video_base64) {
      return NextResponse.json({ error: 'device_id, user_id e video_base64 sao obrigatorios' }, { status: 400 });
    }

    const device = await ensureDeviceBelongsToUser(device_id, user_id);
    if (!device) {
      return NextResponse.json({ error: 'device_id nao pertence ao user_id informado' }, { status: 403 });
    }

    const mimeType = mime_type || 'video/mp4';
    if (!['video/mp4', 'video/webm'].includes(mimeType)) {
      return NextResponse.json({ error: 'mime_type nao suportado' }, { status: 400 });
    }

    const videoBuffer = Buffer.from(stripDataPrefix(video_base64), 'base64');
    if (!videoBuffer.length) {
      return NextResponse.json({ error: 'Payload de video invalido' }, { status: 400 });
    }
    if (videoBuffer.length > MAX_VIDEO_BYTES) {
      return NextResponse.json({ error: 'Video muito grande (max 50MB)' }, { status: 413 });
    }

    const sha256 = crypto.createHash('sha256').update(videoBuffer).digest('hex');
    const ext = mimeType === 'video/webm' ? 'webm' : 'mp4';
    const timestamp = (ts || new Date().toISOString()).replace(/[:.]/g, '-');
    const storageRoot = process.env.RECORDINGS_DIR || '/tmp/pac-control-recordings';
    const day = (ts || new Date().toISOString()).slice(0, 10);
    const targetDir = path.join(storageRoot, safeSegment(day));
    const fileName = `${timestamp}_${safeSegment(user_id)}_${safeSegment(device_id)}_${sha256.slice(0, 12)}.${ext}`;
    const filePath = path.join(targetDir, fileName);

    try {
      await fs.mkdir(targetDir, { recursive: true });
      await fs.writeFile(filePath, videoBuffer);
    } catch {
      // Sem volume — segue apenas com banco.
    }

    const [row] = await sql`
      INSERT INTO video_events (
        device_id, user_id, ts, app_name, url_domain, is_idle,
        mime_type, file_path, sha256, size_bytes, width, height,
        duration_sec, fps, video_bytes
      ) VALUES (
        ${device_id}, ${user_id}, ${ts || new Date().toISOString()},
        ${app_name || null}, ${url_domain || null}, ${Boolean(is_idle)},
        ${mimeType}, ${filePath}, ${sha256}, ${videoBuffer.length},
        ${Number(width || 0) || null}, ${Number(height || 0) || null},
        ${Number(duration_sec || 0) || null}, ${Number(fps || 0) || null},
        ${videoBuffer}
      )
      RETURNING id, ts
    `;

    return NextResponse.json({ ok: true, recording: row });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Erro inesperado' }, { status: 500 });
  }
}
