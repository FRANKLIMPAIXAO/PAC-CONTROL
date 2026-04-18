'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Falha no login');
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid">
      <label>
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@empresa.com"
        />
      </label>

      <label>
        Senha
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="********"
        />
      </label>

      {error ? <div className="error">{error}</div> : null}
      <button type="submit" disabled={loading}>{loading ? 'Acessando...' : 'Acessar PAC CONTROL'}</button>
    </form>
  );
}
