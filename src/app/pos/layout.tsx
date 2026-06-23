import { getPOSSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import POSLogoutButton from '@/components/POSLogoutButton';

export const metadata = {
  title: 'Punto de Venta | REXERMI',
  description: 'Módulo de ventas físicas',
};

export default async function VendedorLayout({ children }: { children: React.ReactNode }) {
  const session = await getPOSSession();

  // If no session or not a vendedor/admin, redirect to login
  if (!session || (session.role !== 'vendedor' && session.role !== 'admin' && session.role !== 'custom')) {
    redirect('/login');
  }

  return (
    <div className="pos-layout-wrapper" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* POS Header */}
      <header className="pos-header" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '1rem 2rem',
        background: 'var(--bg2)',
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--gold)', letterSpacing: '0.5px' }}>REXERMI POS</h1>
          <span style={{ 
            fontSize: '0.82rem', 
            color: 'var(--gold)', 
            background: 'rgba(212, 175, 55, 0.08)', 
            padding: '0.35rem 0.8rem', 
            borderRadius: '8px',
            border: '1px solid rgba(212, 175, 55, 0.25)',
            fontWeight: 600
          }}>
            👤 Vendedor: {session.fullName}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Link href="/" className="btn-outline" style={{ 
            textDecoration: 'none', 
            padding: '0.45rem 0.9rem', 
            borderRadius: '8px',
            fontSize: '0.82rem',
            fontWeight: 600,
            border: '1px solid var(--border)',
            color: 'var(--text)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'var(--bg3)',
            transition: 'all 0.2s'
          }}>
            🛍️ Ver Catálogo
          </Link>
          <POSLogoutButton />
        </div>
      </header>

      {/* POS Content */}
      <main className="pos-layout-main">
        {children}
      </main>
    </div>
  );
}
