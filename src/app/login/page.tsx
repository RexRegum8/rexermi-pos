import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import LoginClient from './LoginClient';

export const metadata = { title: 'Iniciar Sesión — Rexermi Marketplace' };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect('/my-orders');
  }

  return (
    <section className="section" style={{ paddingTop: '1rem' }}>
      <LoginClient />
    </section>
  );
}
