import { requireRoles } from '@/lib/auth-server';
import sql from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

export async function GET() {
  try {
    const session = await requireRoles(['admin', 'manager']);
    const company_id = session.company_id;
    const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    const metrics = await sql`
      SELECT u.id, u.name,
        COALESCE(SUM(m.productive_sec),   0) AS productive_sec,
        COALESCE(SUM(m.neutral_sec),      0) AS neutral_sec,
        COALESCE(SUM(m.unproductive_sec), 0) AS unproductive_sec,
        COALESCE(SUM(m.idle_sec),         0) AS idle_sec,
        COUNT(DISTINCT m.day)               AS days_active
      FROM users u
      LEFT JOIN metrics_daily m ON m.user_id = u.id AND m.day >= ${since}
      WHERE u.company_id = ${company_id} AND u.status = 'active' AND u.role != 'admin'
      GROUP BY u.id, u.name
      HAVING COUNT(DISTINCT m.day) > 0
      ORDER BY u.name
    `;

    if (metrics.length === 0) {
      return Response.json({ ok: true, insights: [], summary: 'Sem dados suficientes. Verifique se os agentes estao instalados.' });
    }

    const urls = await sql`
      SELECT se.user_id, se.url_domain, COUNT(*) AS visits
      FROM screenshot_events se
      JOIN users u ON u.id = se.user_id
      WHERE u.company_id = ${company_id}
        AND se.ts >= NOW() - INTERVAL '7 days'
        AND se.url_domain IS NOT NULL AND se.url_domain != ''
      GROUP BY se.user_id, se.url_domain
      ORDER BY se.user_id, visits DESC
    `;

    const urlMap = {};
    for (const r of urls) {
      if (!urlMap[r.user_id]) urlMap[r.user_id] = [];
      if (urlMap[r.user_id].length < 5) urlMap[r.user_id].push(`${r.url_domain} (${r.visits}x)`);
    }

    const collaborators = metrics.map(m => {
      const total = Number(m.productive_sec) + Number(m.neutral_sec) + Number(m.unproductive_sec) + Number(m.idle_sec);
      const focus = total > 0 ? Math.round(Number(m.productive_sec) / total * 100) : 0;
      return {
        nome: m.name,
        dias_ativos: Number(m.days_active),
        foco_pct: focus,
        produtivo_h: (Number(m.productive_sec) / 3600).toFixed(1),
        ocioso_h:    (Number(m.idle_sec)        / 3600).toFixed(1),
        top_sites: (urlMap[m.id] || []).join(', ') || 'sem dados de URL',
      };
    });

    const prompt = [
      'Voce e a PAC.IA, assistente de analise de produtividade do escritorio PAC Tributaria.',
      '',
      'Analise os dados (ultimos 7 dias) e gere insights comportamentais em portugues brasileiro.',
      '',
      'Regras:',
      '- Gere alerta apenas se houver algo que merea atencao real do gestor',
      '- Foco abaixo de 50% e preocupante',
      '- Ociosidade acima de 3h/dia e sinal de alerta',
      '- Sites suspeitos (redes sociais, streaming) em excesso merecem atencao',
      '- NAO gere alerta para colaboradores com desempenho normal (foco > 60%)',
      '',
      'Dados dos colaboradores:',
      JSON.stringify(collaborators, null, 2),
      '',
      'Responda SOMENTE com JSON valido neste formato:',
      '{"insights":[{"user_name":"...","severity":"alta|media|baixa","observation":"...","action":"..."}],"summary":"..."}',
    ].join('\n');

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = msg.content[0].text.trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Resposta da IA fora do formato esperado');
    const result = JSON.parse(match[0]);
    return Response.json({ ok: true, ...result });

  } catch (err) {
    const m = err?.message || String(err);
    if (m.includes('NEXT_REDIRECT')) throw err;
    console.error('[pac-ia]', m);
    return Response.json({ ok: false, error: m }, { status: 500 });
  }
}
