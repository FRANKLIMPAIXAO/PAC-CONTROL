'use client';

import { useState, useEffect } from 'react';

const ROLE_LABELS = {
  admin: 'Admin',
  rh: 'RH',
  gestor: 'Gestor',
  colaborador: 'Colaborador',
};

export default function ColaboradoresPage() {
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  // modal state
  const [modal, setModal] = useState(null); // { mode: 'new' | 'edit' | 'reset', user? }
  const [form, setForm] = useState({
    name: '', email: '', role: 'colaborador', team_id: '', password: '', status: 'active',
  });
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [uRes, tRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/teams'),
      ]);
      const uData = await uRes.json();
      const tData = await tRes.json();
      if (uData.ok) setUsers(uData.users);
      if (tData.ok) setTeams(tData.teams);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  function openNew() {
    setForm({ name: '', email: '', role: 'colaborador', team_id: '', password: '', status: 'active' });
    setModal({ mode: 'new' });
  }

  function openEdit(user) {
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      team_id: user.team_id || '',
      status: user.status,
      password: '',
    });
    setModal({ mode: 'edit', user });
  }

  function openReset(user) {
    setNewPassword('');
    setModal({ mode: 'reset', user });
  }

  function closeModal() {
    setModal(null);
    setMsg(null);
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      if (modal.mode === 'new') {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (data.ok) {
          await loadAll();
          closeModal();
          setTopMsg({ type: 'ok', text: `Colaborador "${form.name}" criado!` });
        } else {
          setMsg({ type: 'error', text: data.error });
        }
      } else if (modal.mode === 'edit') {
        const res = await fetch(`/api/admin/users/${modal.user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            role: form.role,
            team_id: form.team_id,
            status: form.status,
          }),
        });
        const data = await res.json();
        if (data.ok) {
          await loadAll();
          closeModal();
          setTopMsg({ type: 'ok', text: 'Colaborador atualizado.' });
        } else {
          setMsg({ type: 'error', text: data.error });
        }
      } else if (modal.mode === 'reset') {
        const res = await fetch(`/api/admin/users/${modal.user.id}/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newPassword }),
        });
        const data = await res.json();
        if (data.ok) {
          closeModal();
          setTopMsg({ type: 'ok', text: `Senha de ${modal.user.name} redefinida.` });
        } else {
          setMsg({ type: 'error', text: data.error });
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(user) {
    if (!confirm(`Desativar ${user.name}? O acesso dele sera bloqueado.`)) return;
    const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) {
      await loadAll();
      setTopMsg({ type: 'ok', text: `${user.name} desativado.` });
    } else {
      setTopMsg({ type: 'error', text: data.error });
    }
  }

  const [topMsg, setTopMsg] = useState(null);
  useEffect(() => {
    if (topMsg) {
      const t = setTimeout(() => setTopMsg(null), 4000);
      return () => clearTimeout(t);
    }
  }, [topMsg]);

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Colaboradores</h2>
          <span className="muted">{users.length} no total</span>
        </div>
        <button onClick={openNew} style={{ width: 'auto', padding: '10px 20px' }}>
          + Novo colaborador
        </button>
      </div>

      {topMsg && (
        <div className="card" style={{
          borderLeft: `4px solid ${topMsg.type === 'ok' ? '#059669' : '#dc2626'}`,
          background: topMsg.type === 'ok' ? '#f0fdfa' : '#fef2f2',
          color: topMsg.type === 'ok' ? '#065f46' : '#991b1b',
        }}>
          {topMsg.text}
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="muted">Carregando...</div>
        ) : users.length === 0 ? (
          <div className="muted">Nenhum colaborador cadastrado.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '10px 8px' }}>Nome</th>
                  <th style={{ padding: '10px 8px' }}>Email</th>
                  <th style={{ padding: '10px 8px' }}>Nivel</th>
                  <th style={{ padding: '10px 8px' }}>Time</th>
                  <th style={{ padding: '10px 8px' }}>Status</th>
                  <th style={{ padding: '10px 8px' }}>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 8px' }}>{u.name}</td>
                    <td style={{ padding: '10px 8px', color: '#6b7280' }}>{u.email}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <span className="badge" style={{ fontSize: 12 }}>{ROLE_LABELS[u.role]}</span>
                    </td>
                    <td style={{ padding: '10px 8px', color: '#6b7280' }}>{u.team_name || '—'}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <span className="badge" style={{
                        fontSize: 12,
                        background: u.status === 'active' ? '#d1fae5' : '#fee2e2',
                        color: u.status === 'active' ? '#065f46' : '#991b1b',
                      }}>
                        {u.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button onClick={() => openEdit(u)} style={{ width: 'auto', padding: '4px 10px', fontSize: 12 }}>
                        Editar
                      </button>
                      <button onClick={() => openReset(u)} style={{ width: 'auto', padding: '4px 10px', fontSize: 12, background: '#0f766e' }}>
                        Trocar senha
                      </button>
                      {u.status === 'active' && (
                        <button onClick={() => deactivate(u)} style={{ width: 'auto', padding: '4px 10px', fontSize: 12, background: '#dc2626' }}>
                          Desativar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16,
          }}
        >
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={submit}
            style={{
              background: 'white', borderRadius: 10, padding: 24, maxWidth: 500, width: '100%',
              maxHeight: '90vh', overflowY: 'auto',
            }}
          >
            <h2 style={{ marginTop: 0 }}>
              {modal.mode === 'new' && 'Novo colaborador'}
              {modal.mode === 'edit' && `Editar ${modal.user.name}`}
              {modal.mode === 'reset' && `Trocar senha de ${modal.user.name}`}
            </h2>

            {modal.mode !== 'reset' && (
              <div style={{ display: 'grid', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Nome</label>
                  <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Email</label>
                  <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Nivel de acesso</label>
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={{ width: '100%' }}>
                    <option value="colaborador">Colaborador</option>
                    <option value="gestor">Gestor</option>
                    <option value="rh">RH</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Time</label>
                  <select value={form.team_id} onChange={e => setForm({ ...form, team_id: e.target.value })} style={{ width: '100%' }}>
                    <option value="">— Sem time —</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>

                {modal.mode === 'new' && (
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Senha inicial (minimo 8 caracteres)</label>
                    <input required type="text" minLength={8} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} style={{ width: '100%' }} />
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      O colaborador pode trocar depois em "Meu perfil"
                    </div>
                  </div>
                )}

                {modal.mode === 'edit' && (
                  <>
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Status</label>
                      <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={{ width: '100%' }}>
                        <option value="active">Ativo</option>
                        <option value="inactive">Inativo</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6, marginTop: 12 }}>User ID (Copiar para o Agente)</label>
                      <input 
                        readOnly 
                        value={modal.user?.id || ''} 
                        style={{ width: '100%', background: '#f3f4f6', cursor: 'pointer', fontFamily: 'monospace' }} 
                        onClick={(e) => {
                          navigator.clipboard.writeText(e.target.value);
                          alert('User ID copiado!');
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {modal.mode === 'reset' && (
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Nova senha (minimo 8 caracteres)</label>
                <input required type="text" minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ width: '100%' }} />
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Avise o colaborador para trocar em "Meu perfil" apos o primeiro login.
                </div>
              </div>
            )}

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

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button type="button" onClick={closeModal} style={{ width: 'auto', padding: '10px 20px', background: '#6b7280' }}>
                Cancelar
              </button>
              <button type="submit" disabled={saving} style={{ width: 'auto', padding: '10px 20px' }}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
