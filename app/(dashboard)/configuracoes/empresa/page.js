'use client';

import { useState, useEffect } from 'react';

export default function EmpresaPage() {
  const [company, setCompany] = useState(null);
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    fetch('/api/admin/company')
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setCompany(d.company);
          setName(d.company.name || '');
          setCnpj(d.company.cnpj || '');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, cnpj }),
      });
      const data = await res.json();
      if (data.ok) {
        setCompany(data.company);
        setMsg({ type: 'ok', text: 'Dados da empresa atualizados!' });
      } else {
        setMsg({ type: 'error', text: data.error || 'Erro ao salvar.' });
      }
    } catch {
      setMsg({ type: 'error', text: 'Erro de conexao.' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="card">Carregando...</div>;

  return (
    <form className="card" onSubmit={save} style={{ maxWidth: 640 }}>
      <h2 style={{ marginTop: 0 }}>Dados da empresa</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Estas informacoes aparecem em relatorios e na identificacao da sua conta.
      </p>

      <div style={{ display: 'grid', gap: 14 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
            Nome da empresa
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            required
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
            CNPJ (opcional)
          </label>
          <input
            value={cnpj}
            onChange={e => setCnpj(e.target.value)}
            placeholder="XX.XXX.XXX/0001-XX"
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {msg && (
        <div style={{
          marginTop: 16,
          padding: '10px 14px',
          borderLeft: `4px solid ${msg.type === 'ok' ? '#059669' : '#dc2626'}`,
          background: msg.type === 'ok' ? '#f0fdfa' : '#fef2f2',
          color: msg.type === 'ok' ? '#065f46' : '#991b1b',
          borderRadius: 4,
        }}>
          {msg.text}
        </div>
      )}

      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" disabled={saving} style={{ width: 'auto', padding: '10px 28px' }}>
          {saving ? 'Salvando...' : 'Salvar alteracoes'}
        </button>
      </div>
    </form>
  );
}
