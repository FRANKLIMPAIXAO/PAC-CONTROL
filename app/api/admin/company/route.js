import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireSession } from '@/lib/auth-server';

export async function GET() {
  const session = await requireSession();
  const [user] = await sql`SELECT company_id FROM users WHERE id = ${session.sub} LIMIT 1`;
  if (!user) return NextResponse.json({ error: 'Usuario nao encontrado' }, { status: 404 });

  const [company] = await sql`
    SELECT id, name, cnpj, created_at FROM companies WHERE id = ${user.company_id} LIMIT 1
  `;
  if (!company) return NextResponse.json({ error: 'Empresa nao encontrada' }, { status: 404 });

  return NextResponse.json({ ok: true, company });
}

export async function PUT(req) {
  const session = await requireSession();
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
  }

  try {
    const { name, cnpj } = await req.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nome da empresa e obrigatorio' }, { status: 400 });
    }

    const [admin] = await sql`SELECT company_id FROM users WHERE id = ${session.sub} LIMIT 1`;
    if (!admin) return NextResponse.json({ error: 'Admin nao encontrado' }, { status: 500 });

    const [updated] = await sql`
      UPDATE companies SET name = ${name.trim()}, cnpj = ${cnpj?.trim() || null}
      WHERE id = ${admin.company_id}
      RETURNING id, name, cnpj
    `;

    return NextResponse.json({ ok: true, company: updated });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Erro inesperado' }, { status: 500 });
  }
}
