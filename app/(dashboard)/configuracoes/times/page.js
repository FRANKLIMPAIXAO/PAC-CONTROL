'use client';

import { useState, useEffect } from 'react';

export default function TimesPage() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [msg, setMsg] = useState(null);

  async function loadTeams() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/teams');
      const data = await res.json();
      if (data.ok) setTeams(data.teams);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTeams(); }, []);

  async function createTeam(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
      const data = await res.json();
      if (data.ok) {
        setNewName('');
        await loadTeams();
        setMsg({ type: 'ok', text: 'Time criado!' });
      } else {
        setMsg({ type: 'error', text: data.error });
      }
    } finally {
      setCreating(false);
    }
  }

  async function saveEdit(id) {
    if (!editingName.trim()) return;
    const res = await fetch(`/api/admin/teams/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingName }),
    });
    const data = await res.json();
    if (data.ok) {
      setEditingId(null);
      await loadTeams();
      setMsg({ type: 'ok', text: 'Time atualizado!' });
    } else {
      setMsg({ type: 'error', text: data.error });
    }
  }

  async function deleteTeam(id) {
    if (!confirm('Tem certeza que deseja excluir este time?')) return;
    const res = await fetch(`/api/admin/teams/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) {
      await loadTeams();
      setMsg({ type: 'ok', text: 'Time excluido.' });
    } else {
      setMsg({ type: 'error', text: data.error });
    }
  }

  return (
    <div className="grid" style={{ gap: 20 }}>
      <form className="card" onSubmit={createTeam}>
        <h2 style={{ marginTop: 0 }}>Novo time</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Exemplos: Fiscal, Contabil, RH, Departamento Pessoal.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Nome do time"
            style={{ flex: 1 }}
          />
          <button type="submit" disabled={creating} style={{ width: 'auto', padding: '10px 20px' }}>
            {creating ? 'Criando...' : 'Criar time'}
          </button>
        </div>
      </form>

      {msg && (
        <div className="card" style={{
          borderLeft: `4px solid ${msg.type === 'ok' ? '#059669' : '#dc2626'}`,
          background: msg.type === 'ok' ? '#f0fdfa' : '#fef2f2',
          color: msg.type === 'ok' ? '#065f46' : '#991b1b',
        }}>
          {msg.text}
        </div>
      )}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Times cadastrados</h2>
        {loading ? (
          <div className="muted">Carregando...</div>
        ) : teams.length === 0 ? (
          <div className="muted">Nenhum time cadastrado ainda.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {teams.map(team => (
              <div key={team.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 14px',
                background: '#f9fafb',
                borderRadius: 6,
                border: '1px solid #e5e7eb',
              }}>
                {editingId === team.id ? (
                  <>
                    <input
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      style={{ flex: 1, marginRight: 8 }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => saveEdit(team.id)} style={{ width: 'auto', padding: '6px 14px' }}>
                        Salvar
                      </button>
                      <button onClick={() => setEditingId(null)} style={{ width: 'auto', padding: '6px 14px', background: '#6b7280' }}>
                        Cancelar
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <strong>{team.name}</strong>
                      <span className="muted" style={{ marginLeft: 10, fontSize: 13 }}>
                        {team.member_count} colaborador(es)
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => { setEditingId(team.id); setEditingName(team.name); }}
                        style={{ width: 'auto', padding: '6px 14px', background: '#0f766e' }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => deleteTeam(team.id)}
                        style={{ width: 'auto', padding: '6px 14px', background: '#dc2626' }}
                      >
                        Excluir
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
