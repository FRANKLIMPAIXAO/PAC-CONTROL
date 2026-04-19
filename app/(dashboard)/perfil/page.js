'use client';

import { useState, useEffect } from 'react';

export default function PerfilPage() {
  const [user, setUser] = useState(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then(d => setUser(d.user))
      .catch(() => {});
  }, []);

  async function changePassword(e) {
    e.preventDefault();
    setMsg(null);

    if (newPassword !== confirmPassword) {
      setMsg({ type: 'error', text: 'A nova senha e a confirmacao nao sao iguais.' });
      return;
    }
    if (newPassword.length < 8) {
      setMsg({ type: 'error', text: 'A nova senha precisa ter pelo menos 8 caracteres.' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/me/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.ok) {
        setMsg({ type: 'ok', text: 'Senha alterada com sucesso!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setMsg({ type: 'error', text: data.error || 'Erro ao trocar senha.' });
      }
    } catch {
      setMsg({ type: 'error', text: 'Erro de conexao.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid" style={{ gap: 20, maxWidth: 640 }}>

      <div className="card">
        <h1 style={{ margin: 0 }}>Meu perfil</h1>
        <p className="muted" style={{ marginBottom: 0 }}>
          Informacoes da sua conta e seguranca.
        </p>
      </div>

      {user && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Dados da conta</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Nome</label>
              <div className="muted">{user.name}</div>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Email</label>
              <div className="muted">{user.email}</div>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Nivel de acesso</label>
              <div className="muted">{user.role}</div>
            </div>
          </div>
        </div>
      )}

      <form className="card" onSubmit={changePassword}>
        <h3 style={{ marginTop: 0 }}>Trocar minha senha</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Use pelo menos 8 caracteres. Misture letras, numeros e simbolos.
        </p>

        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Senha atual
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Nova senha
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              minLength={8}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Confirmar nova senha
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              minLength={8}
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
          <button
            type="submit"
            disabled={saving}
            style={{ width: 'auto', padding: '10px 28px' }}
          >
            {saving ? 'Salvando...' : 'Trocar senha'}
          </button>
        </div>
      </form>
    </section>
  );
}
