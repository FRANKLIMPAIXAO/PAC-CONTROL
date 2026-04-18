import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getCurrentSession } from '@/lib/auth-server';

const CONFIG_PATH = join(process.cwd(), 'lib', 'goals-config.json');

function readConfig() {
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
}

export async function GET() {
  const config = readConfig();
  return Response.json(config);
}

export async function POST(req) {
  const session = await getCurrentSession();
  if (!session || session.role !== 'admin') {
    return Response.json({ error: 'Acesso negado' }, { status: 403 });
  }

  const body = await req.json();

  // Validate structure
  if (!Array.isArray(body.periods) || body.periods.length === 0) {
    return Response.json({ error: 'Estrutura inválida' }, { status: 400 });
  }

  for (const p of body.periods) {
    if (
      typeof p.id !== 'string' ||
      typeof p.name !== 'string' ||
      typeof p.dayStart !== 'number' ||
      typeof p.dayEnd !== 'number' ||
      typeof p.focusTarget !== 'number' ||
      p.focusTarget < 0 || p.focusTarget > 100 ||
      p.dayStart < 1 || p.dayEnd > 31 ||
      p.dayStart > p.dayEnd
    ) {
      return Response.json({ error: `Período inválido: ${p.id}` }, { status: 400 });
    }
  }

  writeFileSync(CONFIG_PATH, JSON.stringify(body, null, 2), 'utf-8');
  return Response.json({ ok: true });
}
