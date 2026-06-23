'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { UserSession } from '@/lib/auth';
import SupportChatWidget from '@/components/SupportChatWidget';
import BottomNavigation from '@/components/BottomNavigation';

interface ClientLayoutProps {
  children: React.ReactNode;
  user: UserSession | null;
  siteName: string;
  logoText: string;
  logoUrl: string;
  contactEmail: string;
  contactPhone: string;
  isDbRecoveryMode?: boolean;
  hasSafeBackup?: boolean;
}

export default function ClientLayout({
  children,
  user,
  siteName,
  logoText,
  logoUrl,
  contactEmail,
  contactPhone,
  isDbRecoveryMode = false,
  hasSafeBackup = false,
}: ClientLayoutProps) {
  const pathname = usePathname();

  React.useEffect(() => {
    if (isDbRecoveryMode && pathname !== '/recovery') {
      window.location.href = '/recovery';
    }
  }, [isDbRecoveryMode, pathname]);

  if (isDbRecoveryMode && pathname !== '/recovery') {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0A0A0F',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '1rem',
        fontWeight: 600
      }}>
        Cargando Panel de Recuperación...
      </div>
    );
  }

  // Don't show Navbar/Footer on /admin and /pos paths
  const hideNavigation = pathname.startsWith('/admin') || pathname.startsWith('/pos') || pathname === '/recovery';

  if (hideNavigation) {
    return (
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    );
  }

  return (
    <>
      <Navbar user={user} logoText={logoText} logoUrl={logoUrl} />
      <main style={{ paddingTop: '80px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
      <Footer siteName={siteName} contactEmail={contactEmail} contactPhone={contactPhone} />
      <BottomNavigation user={user} />
      <SupportChatWidget user={user} contactPhone={contactPhone} />
    </>
  );
}
