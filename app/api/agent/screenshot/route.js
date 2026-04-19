import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import sql from '@/lib/db';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB

function authorized(req) {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return Boolean(process.env.AGENT_BOOTSTRAP_TOKEN) && token === process.env.AGENT_BOOTSTRAP_TOKEN;
}

function safeSegment(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'unknown';
}

function extFromMime(mimeType) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

function stripDataPrefix(base64) {
  if (!base64) return '';
  const str = String(base64);
  const match = str.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
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
      image_base64,
      mime_type,
      width,
      height,
    } = body;

    if (!device_id || !user_id || !image_base64) {
      return NextResponse.json({ error: 'device_id, user_id and image_base64 are required' }, { status: 400 });
    }

    const mimeType = mime_type || 'image/jpeg';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      return NextResponse.json({ error: 'Unsupported mime_type' }, { status: 400 });
    }

    const imageBuffer = Buffer.from(stripDataPrefix(image_base64), 'base64');
    if (!imageBuffer.length) {
      return NextResponse.json({ error: 'Invalid image payload' }, { status: 400 });
    }
    if (imageBuffer.length > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Image too large (max 4MB)' }, { status: 413 });
    }

    const sha256 = crypto.createHash('sha256').update(imageBuffer).digest('hex');
    const ext = extFromMime(mimeType);
    const timestamp = (ts || new Date().toISOString()).replace(/[:.]/g, '-');
    const storageRoot = process.env.SCREENSHOTS_DIR || '/tmp/pac-control-screenshots';
    const day = (ts || new Date().toISOString()).slice(0, 10);
    const targetDir = path.join(storageRoot, safeSegment(day));
    const fileName = `${timestamp}_${safeSegment(user_id)}_${safeSegment(device_id)}_${sha256.slice(0, 12)}.${ext}`;
    const filePath = path.join(targetDir, fileName);

    // Persistencia principal agora e no banco (image_bytes).
    // Em paralelo, mantemos tentativa de escrita em disco para compatibilidade.
    try {
      await fs.mkdir(targetDir, { recursive: true });
      await fs.writeFile(filePath, imageBuffer);
    } catch {
      // Sem volume/pasta, segue com armazenamento no banco.
    }

    const [row] = await sql`
      INSERT INTO screenshot_events (
        device_id, user_id, ts, app_name, url_domain, is_idle,
        mime_type, file_path, sha256, size_bytes, width, height, image_bytes
      ) VALUES (
        ${device_id}, ${user_id}, ${ts || new Date().toISOString()},
        ${app_name || null}, ${url_domain || null}, ${Boolean(is_idle)},
        ${mimeType}, ${filePath}, ${sha256}, ${imageBuffer.length},
        ${Number(width || 0) || null}, ${Number(height || 0) || null},
        ${imageBuffer}
      )
      RETURNING id, ts
    `;

    return NextResponse.json({ ok: true, screenshot: row });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 });
  }
}
