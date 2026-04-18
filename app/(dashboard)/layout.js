import TopNav from '@/app/components/top-nav';
import { requireSession } from '@/lib/auth-server';

export default async function DashboardLayout({ children }) {
  const session = await requireSession();

  return (
    <main className="container">
      <TopNav user={session} />
      {children}
    </main>
  );
}
