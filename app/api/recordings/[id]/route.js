import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { promises as fs } from 'fs';
import path from 'path';
import sql from '@/lib/db';
import { verifySessionToken } from '@/lib/session';

const DEFAULT_STORAGE_DIR = '/tmp/pac-control-recordings';

function coerceBinary(value) {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string') {
    if (value.startsWith('\\x')) return Buffer.from(value.slice(2), 'hex');
    return Buffer.from(value, 'base64');
  }
  return null;
}

export async function GET(req, { params }) {
  try {
    const store = await cookies();
    const token = store.get('wm_session')?.value;
    const session = verifySessionToken(token);
    if (!session) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });

    const { id } = params;
    if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 });

    const [rec] = await sql`
      SELECT id, file_path, mime_type, size_bytes, video_bytes
      FROM video_events
      WHERE id = ${id}
      LIMIT 1
    `;

    if (!rec) return NextResponse.json({ error: 'Gravacao nao encontrada' }, { status: 404 });

    const mimeType = rec.mime_type || 'video/mp4';
    const totalSize = rec.size_bytes || 0;

    const bin = coerceBinary(rec.video_bytes);
    const source = bin?.length ? bin : await readFromDisk(rec.file_path);
    if (!source) return NextResponse.json({ error: 'Dados do video nao encontrados' }, { status: 404 });

    // Suporte a Range requests (necessario para <video> no browser)
    const rangeHeader = req.headers.get('range');
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
      if (match) {
        const start = match[1] ? parseInt(match[1], 10) : 0;
        const end = match[2] ? parseInt(match[2], 10) : source.length - 1;
        const chunk = source.slice(start, end + 1);
        return new NextResponse(chunk, {
          status: 206,
          headers: {
            'Content-Type': mimeType,
            'Content-Range': `bytes ${start}-${end}/${source.length}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunk.length),
            'Cache-Control': 'private, max-age=60',
          },
        });
      }
    }

    return new NextResponse(source, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(source.length),
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (err) {
    if (err?.code === 'ENOENT') {
      return NextResponse.json({ error: 'Arquivo nao encontrado em disco' }, { status: 404 });
    }
    return NextResponse.json({ error: err?.message || 'Erro interno' }, { status: 500 });
  }
}

async function readFromDisk(filePath) {
  if (!filePath) return null;
  const storageRoot = path.resolve(process.env.RECORDINGS_DIR || DEFAULT_STORAGE_DIR);
  const absFile = path.resolve(filePath);
  if (!absFile.startsWith(storageRoot + path.sep)) return null;
  return fs.readFile(absFile);
}
