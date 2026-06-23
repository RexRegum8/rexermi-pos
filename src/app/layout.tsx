export const runtime = 'edge';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Script from 'next/script';
import { CartProvider } from '@/context/CartContext';
import { ToastProvider } from '@/context/ToastContext';
import { CurrencyProvider } from '@/context/CurrencyContext';
import ThemeStyleInjector from '@/components/ThemeStyleInjector';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ClientLayout from '@/components/ClientLayout';
import { getSession, getAdminSession } from '@/lib/auth';
import { getSettings } from '@/lib/settings';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const siteName = settings['site_name'] || 'Rexermi Marketplace';
  const siteTagline = settings['site_tagline'] || 'Tu tienda de confianza';
  return {
    title: `${siteName} | ${siteTagline}`,
    description: siteTagline,
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: siteName,
    },
    openGraph: {
      type: 'website',
      siteName,
      title: siteName,
      description: siteTagline,
    },
    twitter: {
      card: 'summary',
      title: siteName,
      description: siteTagline,
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0A0A0F',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user = await getSession();
  const adminSession = await getAdminSession();
  
  if (!user && adminSession) {
    user = {
      id: adminSession.id,
      email: adminSession.username + '@admin.local',
      fullName: (adminSession as any).fullName || adminSession.username,
      role: 'admin'
    };
  }

  const settings = await getSettings();
  
  const siteName = settings['site_name'] || 'Rexermi Marketplace';
  const logoText = settings['logo_text'] || 'REXERMI';
  const logoUrl = settings['logo_url'] || '';
  const contactEmail = settings['contact_email'] || '';
  const contactPhone = settings['contact_phone'] || '';

  return (
    <html lang="es" className={inter.variable}>
      <head>
        {/* Anti-flash script for theme switcher */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const saved = localStorage.getItem('rexermi_theme');
                if (saved === 'light') {
                  document.documentElement.classList.add('light-theme');
                }
              })();
            `,
          }}
        />
        {/* Inject theme variables directly from MySQL DB */}
        <ThemeStyleInjector />
      </head>
      <body style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Service Worker Registration */}
        <Script
          id="register-sw"
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('ServiceWorker registration successful with scope: ', registration.scope);
                    },
                    function(err) {
                      console.log('ServiceWorker registration failed: ', err);
                    }
                  );
                });
              }
            `,
          }}
        />
        <ToastProvider>
          <CartProvider>
            <CurrencyProvider>
              <ClientLayout 
                user={user} 
                siteName={siteName} 
                logoText={logoText} 
                logoUrl={logoUrl} 
                contactEmail={contactEmail} 
                contactPhone={contactPhone}
                isDbRecoveryMode={!!(globalThis as any).isDbRecoveryMode}
                hasSafeBackup={!!(globalThis as any).hasSafeBackup}
              >
                {children}
              </ClientLayout>
            </CurrencyProvider>
          </CartProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
