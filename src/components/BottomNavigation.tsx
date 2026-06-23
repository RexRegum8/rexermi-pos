'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { UserSession } from '@/lib/auth';

interface BottomNavigationProps {
  user: UserSession | null;
}

export default function BottomNavigation({ user }: BottomNavigationProps) {
  const pathname = usePathname();
  const { cartCount } = useCart();

  const isActive = (path: string) => pathname === path;

  // Don't show bottom navigation inside administrative/vendor paths
  const isHidden = pathname.startsWith('/admin') || pathname.startsWith('/pos');
  if (isHidden) return null;

  return (
    <div className="bottom-nav">
      <Link href="/" className={`bottom-nav-item ${isActive('/') ? 'active' : ''}`}>
        <span className="bottom-nav-icon">🛍️</span>
        <span className="bottom-nav-label">Catálogo</span>
      </Link>

      <Link href="/cart" className={`bottom-nav-item ${isActive('/cart') ? 'active' : ''}`} style={{ position: 'relative' }}>
        <span className="bottom-nav-icon">🛒</span>
        <span className="bottom-nav-label">Carrito</span>
        {cartCount > 0 && (
          <span className="bottom-nav-badge">{cartCount}</span>
        )}
      </Link>

      {user ? (
        <>
          <Link href="/my-orders" className={`bottom-nav-item ${isActive('/my-orders') ? 'active' : ''}`}>
            <span className="bottom-nav-icon">📦</span>
            <span className="bottom-nav-label">Pedidos</span>
          </Link>
          <Link href="/profile" className={`bottom-nav-item ${isActive('/profile') ? 'active' : ''}`}>
            <span className="bottom-nav-icon">👤</span>
            <span className="bottom-nav-label">Perfil</span>
          </Link>
        </>
      ) : (
        <Link href="/login" className={`bottom-nav-item ${isActive('/login') ? 'active' : ''}`}>
          <span className="bottom-nav-icon">👤</span>
          <span className="bottom-nav-label">Ingresar</span>
        </Link>
      )}
    </div>
  );
}
