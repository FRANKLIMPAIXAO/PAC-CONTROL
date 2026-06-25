'use client';
import { useEffect, useState, useCallback } from 'react';

const SEV = {
  alta:  { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Alta' },
  media: { color: '#d97706', bg: '#fffbeb', border: '#fed7aa', label: 'Media' },
  baixa: { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'Baixa' },
};

function InsightCard({ ins }) {
  const cfg = SEV[ins.severity] || SEV.baixa;
  return (
    <div style={{
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderLeft: `4px solid ${cfg.color}`,
      borderRadius: 10,
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{ins.user_name}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'white', background: cfg.color, borderRadius: 20, padding: '3px 12px' }}>
          {cfg.label}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.6 }}>{ins.observation}</p>
      <div style={{ fontSize: 13, color: cfg.color, fontWeight: 600, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        <span style={{ flexShrink: 0 }}>&#8594;</span>
        <span>{ins.action}</span>
      </div>
    </div>
  );
}

export default function PacIaPage() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [lastRun, setLastRun] = useState(null);

  const analyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch('/api/ai/insights');
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Erro desconhecido');
      setData(json);
      setLastRun(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { analyze(); }, [analyze]);

  const sorted = data?.insights
    ? [...data.insights].sort((a, b) => ({ alta: 0, media: 1, baixa: 2 }[a.severity] ?? 3) - ({ alta: 0, media: 1, baixa: 2 }[b.severity] ?? 3))
    : [];

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="page-header">
        <div>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ background: 'linear-gradient(135deg,#6366f1,#0ea5e9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 900, fontSize: 28 }}>
              PAC.IA
            </span>
            <span style={{ fontSize: 14, fontWeight: 400, color: '#94a3b8' }}>Analise comportamental da equipe</span>
          </h1>
          {lastRun && (
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
              Ultima analise: {lastRun.toLocaleTimeString('pt-BR')} &bull; ultimos 7 dias
            </p>
          )}
        </div>
        <button onClick={analyze} disabled={loading} style={{ width: 'auto', padding: '10px 24px', background: loading ? '#94a3b8' : 'linear-gradient(135deg,#6366f1,#0ea5e9)', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14, border: 'none', borderRadius: 8, color: 'white' }}>
          {loading ? 'Analisando...' : 'Analisar agora'}
        </button>
      </div>

      {error && (
        <div className="card" style={{ borderLeft: '4px solid #dc2626', background: '#fef2f2', color: '#991b1b' }}>
          <strong>Erro:</strong> {error}
          {error.includes('ANTHROPIC_API_KEY') && (
            <p style={{ margin: '8px 0 0', fontSize: 13 }}>Adicione ANTHROPIC_API_KEY no EasyPanel (App &gt; Environment) e redeploy.</p>
          )}
        </div>
      )}

      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: 56 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>&#129504;</div>
          <div style={{ fontWeight: 700, fontSize: 16, background: 'linear-gradient(135deg,#6366f1,#0ea5e9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            PAC.IA esta analisando os dados da equipe...
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>Isso pode levar alguns segundos</div>
        </div>
      )}

      {!loading && data && (
        <>
          {data.summary && (
            <div style={{ background: 'linear-gradient(135deg,#f0f4ff,#fafbff)', border: '1px solid #c7d2fe', borderRadius: 10, padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>&#10022;</span>
              <p style={{ margin: 0, fontSize: 15, color: '#1e1b4b', fontWeight: 500, lineHeight: 1.7 }}>{data.summary}</p>
            </div>
          )}
          {sorted.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h3 style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {sorted.length} alerta{sorted.length !== 1 ? 's' : ''} identificado{sorted.length !== 1 ? 's' : ''}
              </h3>
              {sorted.map((ins, i) => <InsightCard key={i} ins={ins} />)}
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>&#9989;</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#059669' }}>Tudo bem por aqui!</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Nenhum padrao preocupante identificado nos ultimos 7 dias.</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
