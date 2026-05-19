import { NextResponse } from 'next/server';
import sql from '@/lib/db';

function authorized(req) {
  const h = req.headers.get('authorization') || '';
  const t = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  return [process.env.DASHBOARD_API_TOKEN, process.env.CRON_SECRET].filter(Boolean).includes(t);
}

function formatDur(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export async function POST(req) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // Get all companies
  const companies = await sql`SELECT id, name FROM companies`;
  const results = [];

  for (const company of companies) {
    // Get admin email
    const admins = await sql`SELECT email, name FROM users WHERE company_id = ${company.id} AND role = 'admin' AND status = 'active' LIMIT 3`;
    if (!admins.length) continue;

    // Get metrics for yesterday
    const rows = await sql`
      SELECT u.name, u.email,
             md.productive_sec, md.neutral_sec, md.unproductive_sec, md.idle_sec, md.focus_score
      FROM metrics_daily md
      JOIN users u ON u.id = md.user_id
      WHERE md.day = ${yesterday}
        AND u.company_id = ${company.id}
        AND u.status = 'active'
      ORDER BY md.focus_score DESC NULLS LAST
    `;

    if (!rows.length) continue;

    const target = 65;
    const acima = rows.filter(r => (r.focus_score || 0) >= target);
    const abaixo = rows.filter(r => (r.focus_score || 0) < target);
    const totalIdle = rows.reduce((s, r) => s + (r.idle_sec || 0), 0);
    const totalProd = rows.reduce((s, r) => s + (r.productive_sec || 0), 0);

    const rowsHtml = rows.map(r => {
      const focus = r.focus_score || 0;
      const color = focus >= target ? '#059669' : '#dc2626';
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9">${r.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9">${formatDur(r.productive_sec||0)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9">${formatDur(r.idle_sec||0)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:${color};font-weight:700">${focus.toFixed(1)}%</td>
      </tr>`;
    }).join('');

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:#0f172a;color:white;padding:20px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;font-size:20px">📊 PAC CONTROL — Relatório de ${yesterday}</h1>
    <p style="margin:4px 0 0;opacity:0.7">${company.name}</p>
  </div>
  <div style="background:#f8fafc;padding:20px;border-radius:0 0 8px 8px">
    <div style="display:flex;gap:16px;margin-bottom:20px">
      <div style="background:white;padding:16px;border-radius:8px;flex:1;text-align:center">
        <div style="font-size:24px;font-weight:800;color:#059669">${acima.length}</div>
        <div style="font-size:12px;color:#64748b">Acima da meta</div>
      </div>
      <div style="background:white;padding:16px;border-radius:8px;flex:1;text-align:center">
        <div style="font-size:24px;font-weight:800;color:#dc2626">${abaixo.length}</div>
        <div style="font-size:12px;color:#64748b">Abaixo da meta</div>
      </div>
      <div style="background:white;padding:16px;border-radius:8px;flex:1;text-align:center">
        <div style="font-size:24px;font-weight:800;color:#0f172a">${formatDur(totalProd)}</div>
        <div style="font-size:12px;color:#64748b">Total produtivo</div>
      </div>
    </div>
    <table style="width:100%;background:white;border-radius:8px;border-collapse:collapse">
      <thead>
        <tr style="background:#f1f5f9">
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b">COLABORADOR</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b">PRODUTIVO</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b">OCIOSO</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b">FOCO</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <p style="font-size:11px;color:#94a3b8;margin-top:16px;text-align:center">PAC CONTROL — Monitoramento de Produtividade</p>
  </div>
</body>
</html>`;

    // Send via Resend API
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      for (const admin of admins) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'PAC CONTROL <relatorios@paccontrol.com.br>',
            to: [admin.email],
            subject: `📊 Relatório Diário — ${yesterday} — ${company.name}`,
            html,
          }),
        });
      }
    }
    results.push({ company: company.name, rows: rows.length, sent_to: admins.map(a => a.email) });
  }

  return NextResponse.json({ ok: true, results });
}
