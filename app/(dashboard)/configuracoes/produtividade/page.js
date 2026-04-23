'use client';

import { useState, useEffect } from 'react';

const CATEGORY_LABELS = {
  productive:   { label: 'Produtivo',    color: '#065f46', bg: '#d1fae5', border: '#059669' },
  neutral:      { label: 'Neutro',       color: '#374151', bg: '#f3f4f6', border: '#9ca3af' },
  unproductive: { label: 'Improdutivo',  color: '#991b1b', bg: '#fee2e2', border: '#dc2626' },
};

function CategoryBadge({ category }) {
  const s = CATEGORY_LABELS[category] || CATEGORY_LABELS.neutral;
  return (
    <span style={{
      fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {s.label}
    </span>
  );
}

function CategorySelect({ value, onChange }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ fontSize: 13, padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db' }}>
      <option value="productive">Produtivo</option>
      <option value="neutral">Neutro</option>
      <option value="unproductive">Improdutivo</option>
    </select>
  );
}

export default function ProdutividadePage() {
  const [classifications, setClassifications] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [deletedIds, setDeletedIds] = useState([]);
  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState('productive');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetch('/api/admin/produtividade')
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
        return d;
      })
      .then(d => {
        setClassifications(d.classifications || []);
        setSuggestions(d.suggestions || []);
      })
      .catch(err => setMsg({ type: 'error', text: `Erro: ${err.message}` }))
      .finally(() => setLoading(false));
  }, []);

  function updateCategoryAt(idx, category) {
    setClassifications(prev => prev.map((c, i) => i === idx ? { ...c, category } : c));
  }

  function removeAt(idx) {
    const item = classifications[idx];
    if (item?.id) setDeletedIds(prev => [...prev, item.id]);
    setClassifications(prev => prev.filter((_, i) => i !== idx));
  }

  function addFromSuggestion(s) {
    setSuggestions(prev => prev.filter(x => x.name !== s.name));
    setClassifications(prev => [...prev, { app_or_domain: s.name, category: 'productive', _new: true }]);
  }

  function addCustom() {
    const name = newName.trim().toLowerCase();
    if (!name) return;
    if (classifications.some(c => c.app_or_domain === name)) {
      setMsg({ type: 'error', text: `"${name}" ja esta na lista.` });
      return;
    }
    setClassifications(prev => [...prev, { app_or_domain: name, category: newCat, _new: true }]);
    setSuggestions(prev => prev.filter(s => s.name !== name));
    setNewName('');
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/produtividade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upserts: classifications.map(c => ({
            id: c.id || undefined,
            app_or_domain: c.app_or_domain,
            category: c.category,
          })),
          deleted_ids: deletedIds,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setDeletedIds([]);
        setMsg({ type: 'ok', text: 'Configuracoes salvas com sucesso!' });
        // Reload to get fresh IDs for newly inserted rows
        const fresh = await fetch('/api/admin/produtividade').then(r => r.json()).catch(() => ({}));
        setClassifications(fresh.classifications || []);
        setSuggestions(fresh.suggestions || []);
      } else {
        setMsg({ type: 'error', text: data.error || 'Erro ao salvar.' });
      }
    } catch {
      setMsg({ type: 'error', text: 'Erro de conexao.' });
    } finally {
      setSaving(false);
    }
  }

  const filtered = classifications.filter(c =>
    !filter || c.app_or_domain.toLowerCase().includes(filter.toLowerCase())
  );

  const counts = {
    productive:   classifications.filter(c => c.category === 'productive').length,
    neutral:      classifications.filter(c => c.category === 'neutral').length,
    unproductive: classifications.filter(c => c.category === 'unproductive').length,
  };

  if (loading) {
    return <div className="card"><p className="muted">Carregando...</p></div>;
  }

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Classificacao de produtividade</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          Defina quais sites e aplicativos sao produtivos, neutros ou improdutivos.
          O relatorio de produtividade usa essas regras para calcular o tempo util de cada colaborador.
        </p>
      </div>

      {/* Resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {Object.entries(CATEGORY_LABELS).map(([key, s]) => (
          <div key={key} className="card" style={{ borderTop: `3px solid ${s.border}`, padding: '12px 16px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{counts[key]}</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Lista de classificações */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Regras cadastradas ({classifications.length})</h3>
          <input
            placeholder="Filtrar..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ width: 200, fontSize: 13, padding: '6px 10px' }}
          />
        </div>

        {filtered.length === 0 && (
          <p className="muted" style={{ textAlign: 'center', padding: '20px 0' }}>
            Nenhuma regra cadastrada. Adicione abaixo ou escolha da lista de sugestoes.
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((c, filteredIdx) => {
            const realIdx = classifications.indexOf(c);
            return (
              <div key={c.id || `new-${filteredIdx}`} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 8,
                background: '#f9fafb', border: '1px solid #e5e7eb',
              }}>
                <span style={{ flex: 1, fontFamily: 'monospace', fontSize: 14, fontWeight: 500 }}>
                  {c.app_or_domain}
                </span>
                <CategorySelect value={c.category} onChange={cat => updateCategoryAt(realIdx, cat)} />
                <button
                  onClick={() => removeAt(realIdx)}
                  style={{
                    padding: '4px 10px', fontSize: 12, background: 'transparent',
                    border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 6,
                    cursor: 'pointer', width: 'auto',
                  }}
                >
                  Remover
                </button>
              </div>
            );
          })}
        </div>

        {/* Adicionar entrada customizada */}
        <div style={{
          display: 'flex', gap: 8, marginTop: 16, paddingTop: 16,
          borderTop: '1px solid #e5e7eb', alignItems: 'center',
        }}>
          <input
            type="text"
            placeholder="Digite o nome do ERP ou domínio..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustom()}
            style={{ flex: 1, minWidth: '250px', fontSize: 14, padding: '10px 14px', border: '2px solid #0f766e', borderRadius: 6, background: '#ffffff', color: '#000000' }}
          />
          <CategorySelect value={newCat} onChange={setNewCat} />
          <button onClick={addCustom} style={{ width: 'auto', padding: '8px 16px', fontSize: 13 }}>
            Adicionar
          </button>
        </div>
      </div>

      {/* Sugestoes automaticas */}
      {suggestions.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Descobertos automaticamente</h3>
          <p className="muted" style={{ marginTop: -8, marginBottom: 16, fontSize: 13 }}>
            Apps e sites encontrados nos ultimos 30 dias que ainda nao foram classificados.
            Clique para adicionar como produtivo (voce pode alterar depois).
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {suggestions.map(s => (
              <button
                key={s.name}
                onClick={() => addFromSuggestion(s)}
                title={`Tipo: ${s.type}`}
                style={{
                  padding: '6px 14px', fontSize: 13, width: 'auto', cursor: 'pointer',
                  background: s.type === 'site' ? '#eff6ff' : '#f5f3ff',
                  border: `1px solid ${s.type === 'site' ? '#bfdbfe' : '#ddd6fe'}`,
                  color: s.type === 'site' ? '#1d4ed8' : '#6d28d9',
                  borderRadius: 6,
                }}
              >
                {s.type === 'site' ? '🌐' : '💻'} {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {msg && (
        <div className="card" style={{
          borderLeft: `4px solid ${msg.type === 'ok' ? '#059669' : '#dc2626'}`,
          background: msg.type === 'ok' ? '#f0fdfa' : '#fef2f2',
          color: msg.type === 'ok' ? '#065f46' : '#991b1b',
        }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={save} disabled={saving} style={{ width: 'auto', padding: '10px 28px', fontSize: 15 }}>
          {saving ? 'Salvando...' : 'Salvar configuracoes'}
        </button>
      </div>
    </div>
  );
}
