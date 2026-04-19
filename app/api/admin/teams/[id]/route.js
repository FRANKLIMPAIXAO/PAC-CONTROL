import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireSession } from '@/lib/auth-server';

export async function PUT(req, { params }) {
  const session = await requireSession();
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
  }
  try {
    const { id } = await params;
    const { name } = await req.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nome do time e obrigatorio' }, { status: 400 });
    }
    const [updated] = await sql`
      UPDATE teams SET name = ${name.trim()} WHERE id = ${id}
      RETURNING id, name
    `;
    if (!updated) return NextResponse.json({ error: 'Time nao encontrado' }, { status: 404 });
    return NextResponse.json({ ok: true, team: updated });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Erro inesperado' }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  const session = await requireSession();
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
  }
  try {
    const { id } = await params;
    const [{ count }] = await sql`
      SELECT COUNT(*)::int AS count FROM users WHERE team_id = ${id} AND status = 'active'
    `;
    if (count > 0) {
      return NextResponse.json({
        error: `Nao e possivel excluir: ${count} colaborador(es) ativo(s) neste time. Mova-os antes.`,
      }, { status: 400 });
    }
    await sql`DELETE FROM teams WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Erro inesperado' }, { status: 500 });
  }
}
