import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getCurrentSession } from '@/lib/auth-server';

async function getSession() {
  const session = await getCurrentSession();
  if (!session || !['admin', 'gestor'].includes(session.role)) return null;
  return session;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  try {
    // Busca company_id real do banco (session pode ter valor do JWT)
    const [userRow] = await sql`SELECT company_id FROM users WHERE id = ${session.sub} LIMIT 1`;
    const companyId = userRow?.company_id || session.company_id;

    const [classifications, rawApps, rawDomains] = await Promise.all([
      sql`
        SELECT id, app_or_domain, category
        FROM app_classification
        WHERE company_id = ${companyId}
        ORDER BY app_or_domain
      `,
      sql`
        SELECT LOWER(er.app_name) AS name, COUNT(*) AS total
        FROM events_raw er
        JOIN users u ON u.id = er.user_id
        WHERE u.company_id = ${companyId}
          AND er.app_name IS NOT NULL AND er.app_name <> ''
          AND er.ts >= NOW() - INTERVAL '30 days'
        GROUP BY LOWER(er.app_name)
        ORDER BY total DESC
        LIMIT 40
      `,
      sql`
        SELECT LOWER(er.url_domain) AS name, COUNT(*) AS total
        FROM events_raw er
        JOIN users u ON u.id = er.user_id
        WHERE u.company_id = ${companyId}
          AND er.url_domain IS NOT NULL AND er.url_domain <> ''
          AND er.ts >= NOW() - INTERVAL '30 days'
        GROUP BY LOWER(er.url_domain)
        ORDER BY total DESC
        LIMIT 40
      `,
    ]);

    const classifiedSet = new Set(classifications.map(c => c.app_or_domain.toLowerCase()));

    const suggestions = [
      ...rawApps.filter(r => !classifiedSet.has(r.name)).map(r => ({ name: r.name, type: 'app' })),
      ...rawDomains.filter(r => !classifiedSet.has(r.name)).map(r => ({ name: r.name, type: 'site' })),
    ];

    return NextResponse.json({ classifications, suggestions });
  } catch (err) {
    console.error('[produtividade GET]', err);
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const body = await req.json();
  const { upserts = [], deleted_ids = [] } = body;

  const validCategories = new Set(['productive', 'neutral', 'unproductive']);
  for (const u of upserts) {
    if (!u.app_or_domain || typeof u.app_or_domain !== 'string') {
      return NextResponse.json({ error: 'app_or_domain invalido' }, { status: 400 });
    }
    if (!validCategories.has(u.category)) {
      return NextResponse.json({ error: `Categoria invalida: ${u.category}` }, { status: 400 });
    }
  }

  if (deleted_ids.length > 0) {
    await sql`
      DELETE FROM app_classification
      WHERE id = ANY(${deleted_ids}::uuid[])
        AND company_id = ${session.company_id}
    `;
  }

  for (const u of upserts) {
    const name = u.app_or_domain.trim().toLowerCase();
    if (u.id) {
      await sql`
        UPDATE app_classification
        SET category = ${u.category}, app_or_domain = ${name}
        WHERE id = ${u.id} AND company_id = ${session.company_id}
      `;
    } else {
      await sql`
        INSERT INTO app_classification (company_id, app_or_domain, category, score)
        VALUES (${session.company_id}, ${name}, ${u.category}, ${u.category === 'productive' ? 100 : u.category === 'unproductive' ? 0 : 50})
        ON CONFLICT (company_id, app_or_domain) DO UPDATE SET category = EXCLUDED.category, score = EXCLUDED.score
      `;
    }
  }

  return NextResponse.json({ ok: true });
}
