import { requireRoles } from '@/lib/auth-server';
import sql from '@/lib/db';

function sec2h(s) { return ((s||0)/3600).toFixed(2); }

export async function GET(req) {
  const session = await requireRoles(['admin']);
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') || new Date(Date.now()-29*86400000).toISOString().slice(0,10);
  const to   = searchParams.get('to')   || new Date().toISOString().slice(0,10);

  const rows = await sql`
    SELECT u.name, u.email, COALESCE(u.salary_monthly,0) AS salary_monthly,
           SUM(md.productive_sec)::int   AS prod,
           SUM(md.neutral_sec)::int      AS neutral,
           SUM(md.unproductive_sec)::int AS unprod,
           SUM(md.idle_sec)::int         AS idle,
           COUNT(DISTINCT md.day)::int   AS days
    FROM metrics_daily md
    JOIN users u ON u.id = md.user_id
    WHERE md.day >= ${from} AND md.day <= ${to}
      AND u.company_id = ${session.company_id}
    GROUP BY u.id, u.name, u.email, u.salary_monthly
    ORDER BY prod DESC
  `;

  const header = 'Nome,Email,Dias,Produtivo(h),Neutro(h),Improdutivo(h),Ocioso(h),Foco%,Salario Mensal,Custo Ociosidade';
  const lines = rows.map(r => {
    const active = (r.prod||0)+(r.neutral||0)+(r.unprod||0);
    const focus  = active>0 ? ((r.prod||0)/active*100).toFixed(1) : '0.0';
    const loss   = ((r.salary_monthly||0)/(22*8)*(r.idle||0)/3600).toFixed(2);
    return [r.name, r.email, r.days, sec2h(r.prod), sec2h(r.neutral),
            sec2h(r.unprod), sec2h(r.idle), focus,
            (r.salary_monthly||0).toFixed(2), loss].join(',');
  });

  return new Response('﻿'+[header,...lines].join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="relatorio-pac-${from}-${to}.csv"`,
    },
  });
}
