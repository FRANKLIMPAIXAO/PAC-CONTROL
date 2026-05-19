'use client';

import { useState, useEffect, useCallback } from 'react';

const TYPE_LABELS = {
  idle_too_long: 'Ocioso por muito tempo',
  below_focus: 'Foco abaixo da meta',
  unproductive_site: 'Site improdutivo',
  offline_too_long: 'Offline por muito tempo',
};

const TYPE_UNIT = {
  idle_too_long: 'min',
  below_focus: '%',
  unproductive_site: 'min',
  offline_too_long: 'min',
};

export default function AlertasPage() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'idle_too_long',
    threshold: 30,
    enabled: true,
    notify_email: true,
  });

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/alert-rules');
      if (!res.ok) throw new Error('Erro ao carregar regras');
      const data = await res.json();
      setRules(data.rules || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/alert-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Erro ao criar regra');
      }
      setForm({ name: '', type: 'idle_too_long', threshold: 30, enabled: true, notify_email: true });
      await fetchRules();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(rule) {
    try {
      const res = await fetch(`/api/admin/alert-rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      if (!res.ok) throw new Error('Erro ao atualizar regra');
      await fetchRules();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Excluir esta regra de alerta?')) return;
    try {
      const res = await fetch(`/api/admin/alert-rules/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir regra');
      await fetchRules();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
        Alertas Configuráveis
      </h1>
      <p style={{ color: '#64748b', marginBottom: 24 }}>
        Configure regras de alerta automático para sua equipe.
      </p>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', color: '#dc2626', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Form de criação */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Nova Regra</h2>
        <form onSubmit={handleCreate}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
                NOME DA REGRA
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Alerta de ociosidade"
                required
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
                TIPO
              </label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, background: 'white', boxSizing: 'border-box' }}
              >
                <option value="idle_too_long">Ocioso por muito tempo</option>
                <option value="below_focus">Foco abaixo da meta</option>
                <option value="offline_too_long">Offline por muito tempo</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16, alignItems: 'center' }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
                LIMITE ({TYPE_UNIT[form.type]})
              </label>
              <input
                type="number"
                value={form.threshold}
                onChange={e => setForm(f => ({ ...f, threshold: Number(e.target.value) }))}
                min={1}
                max={9999}
                required
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
              <input
                type="checkbox"
                id="enabled"
                checked={form.enabled}
                onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
              />
              <label htmlFor="enabled" style={{ fontSize: 14, color: '#374151' }}>Habilitada</label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
              <input
                type="checkbox"
                id="notify_email"
                checked={form.notify_email}
                onChange={e => setForm(f => ({ ...f, notify_email: e.target.checked }))}
              />
              <label htmlFor="notify_email" style={{ fontSize: 14, color: '#374151' }}>Notificar por email</label>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              background: saving ? '#94a3b8' : '#0f172a',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Criando...' : 'Criar Regra'}
          </button>
        </form>
      </div>

      {/* Lista de regras */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>
            Regras Configuradas {rules.length > 0 && <span style={{ color: '#64748b', fontWeight: 400 }}>({rules.length})</span>}
          </h2>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>Carregando...</div>
        ) : rules.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
            Nenhuma regra configurada. Crie a primeira acima.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '10px 24px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', letterSpacing: '0.05em' }}>NOME</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', letterSpacing: '0.05em' }}>TIPO</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', letterSpacing: '0.05em' }}>LIMITE</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#64748b', letterSpacing: '0.05em' }}>STATUS</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#64748b', letterSpacing: '0.05em' }}>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(rule => (
                <tr key={rule.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 24px', fontSize: 14, color: '#0f172a', fontWeight: 500 }}>
                    {rule.name}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#475569' }}>
                    {TYPE_LABELS[rule.type] || rule.type}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#475569' }}>
                    {rule.threshold} {TYPE_UNIT[rule.type] || ''}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleToggle(rule)}
                      style={{
                        background: rule.enabled ? '#dcfce7' : '#f1f5f9',
                        color: rule.enabled ? '#059669' : '#94a3b8',
                        border: 'none',
                        borderRadius: 20,
                        padding: '4px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {rule.enabled ? 'Ativa' : 'Inativa'}
                    </button>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      style={{
                        background: 'transparent',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        borderRadius: 6,
                        padding: '4px 12px',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
