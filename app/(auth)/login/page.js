import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/auth-server';
import LoginForm from './login-form';

export default async function LoginPage() {
  const session = await getCurrentSession();
  if (session) redirect('/dashboard');

  return (
    <main className="container" style={{ maxWidth: 420, marginTop: 80 }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Acesso PAC CONTROL</h1>
        <p className="muted">Use seu email corporativo e senha para entrar no sistema.</p>
        <LoginForm />
      </div>
    </main>
  );
}
