import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { promises as fs } from 'fs';
import path from 'path';
import sql from '@/lib/db';
import { verifySessionToken } from '@/lib/session';

const DEFAULT_STORAGE_DIR = '/tmp/pac-control-screenshots';

function coerceBinary(value) {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string') {
    // Alguns drivers retornam bytea em formato "\\xABCD..."
    if (value.startsWith('\\x')) return Buffer.from(value.slice(2), 'hex');
    return Buffer.from(value, 'base64');
  }
  return null;
}

export async function GET(_req, { params }) {
  try {
    const store = await cookies();
    const token = store.get('wm_session')?.value;
    const session = verifySessionToken(token);
    if (!session) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });

    const { id } = params;
    if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 });

    const [shot] = await sql`
      SELECT id, file_path, mime_type, image_bytes
      FROM screenshot_events
      WHERE id = ${id}
      LIMIT 1
    `;

    if (!shot) return NextResponse.json({ error: 'Screenshot nao encontrado' }, { status: 404 });

    const bin = coerceBinary(shot.image_bytes);
    if (bin?.length) {
      return new NextResponse(bin, {
        status: 200,
        headers: {
          'Content-Type': shot.mime_type || 'image/jpeg',
          'Cache-Control': 'private, max-age=60',
        },
      });
    }

    if (!shot.file_path) return NextResponse.json({ error: 'Screenshot sem arquivo' }, { status: 404 });

    const storageRoot = path.resolve(process.env.SCREENSHOTS_DIR || DEFAULT_STORAGE_DIR);
    const absFile = path.resolve(shot.file_path);
    if (!absFile.startsWith(storageRoot + path.sep)) {
      return NextResponse.json({ error: 'Arquivo invalido' }, { status: 400 });
    }

    const content = await fs.readFile(absFile);
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': shot.mime_type || 'image/jpeg',
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
