import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionToken } from './session';

const DEMO_SESSION = {
  sub: 'demo-user-id',
  name: 'Admin Demo',
  email: 'admin@suaempresa.com',
  role: 'admin',
  company_id: 'demo-company-id',
};

export async function getCurrentSession() {
  if (process.env.DEMO_MODE === 'true') return DEMO_SESSION;
  const cookieStore = await cookies();
  const token = cookieStore.get('wm_session')?.value;
  return verifySessionToken(token);
}

export async function requireSession() {
  if (process.env.DEMO_MODE === 'true') return DEMO_SESSION;
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  return session;
}

export async function requireRoles(roles) {
  const session = await requireSession();
  if (!roles.includes(session.role)) redirect('/dashboard');
  return session;
}
