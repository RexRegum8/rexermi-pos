'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useCurrency } from '@/context/CurrencyContext';
import ThemeToggle from './ThemeToggle';
import { UserSession } from '@/lib/auth';

interface NavbarProps {
  user: UserSession | null;
  logoText: string;
  logoUrl?: string;
}

function AutocompleteSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const router = useRouter();
  const { formatPriceLocal } = useCurrency();

  React.useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(query)}&limit=5`);
        const data = (await res.json()) as any;
        if (data.success) {
          setResults(data.products);
          setIsOpen(true);
          setActiveIndex(-1);
        }
      } catch (err) {
        console.error('Search error:', err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSearch = (val: string) => {
    setQuery(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < results.length) {
        e.preventDefault();
        const selectedProduct = results[activeIndex];
        setIsOpen(false);
        setQuery('');
        router.push(`/product/${selectedProduct.slug}`);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div style={{ position: 'relative', flex: 1, maxWidth: '300px', margin: '0 1rem' }}>
      <input 
        type="text" 
        placeholder="Buscar productos..." 
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        onFocus={() => { if (results.length > 0) setIsOpen(true); }}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={isOpen && results.length > 0}
        aria-autocomplete="list"
        aria-controls="search-results-listbox"
        aria-activedescendant={activeIndex >= 0 ? `result-item-${activeIndex}` : undefined}
        style={{ 
          width: '100%', padding: '0.5rem 1rem', borderRadius: '20px', 
          border: '1px solid var(--border)', background: 'var(--bg2)', 
          color: 'var(--text)', outline: 'none' 
        }}
      />
      {isOpen && results.length > 0 && (
        <div 
          id="search-results-listbox"
          role="listbox"
          aria-label="Resultados de búsqueda"
          style={{ 
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '0.5rem', 
            background: 'var(--bg)', border: '1px solid var(--border)', 
            borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 1000 
          }}
        >
          {results.map((p, index) => (
            <Link 
              key={p.id} 
              id={`result-item-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              href={`/product/${p.slug}`} 
              onClick={() => {
                setIsOpen(false);
                setQuery('');
              }}
              onMouseEnter={() => setActiveIndex(index)}
              style={{ 
                display: 'flex', alignItems: 'center', padding: '0.5rem 1rem', 
                textDecoration: 'none', color: 'var(--text)', borderBottom: '1px solid var(--border)',
                background: index === activeIndex ? 'var(--glass)' : 'transparent'
              }}
            >
              {p.image && (
                <div style={{ position: 'relative', width: '30px', height: '30px', flexShrink: 0, borderRadius: '4px', overflow: 'hidden', marginRight: '0.8rem' }}>
                  <Image
                    src={p.image.startsWith('http') ? p.image : `/${p.image}`}
                    alt={p.name}
                    fill
                    sizes="30px"
                    style={{ objectFit: 'cover' }}
                  />
                </div>
              )}
              <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.85rem' }}>{p.name}</div>
              <div style={{ fontWeight: 'bold', color: 'var(--gold)', fontSize: '0.85rem' }}>{formatPriceLocal(Number(p.price))}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Navbar({ user, logoText, logoUrl }: NavbarProps) {
  const { cartCount } = useCart();
  const { currency, setCurrency } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      closeMenu();
      window.location.href = '/';
    } catch (e) {
      console.error('Logout error', e);
    }
  };

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="navbar">
      <div className="section-inner nav-inner">
        {/* LOGO */}
        <Link href="/" className="nav-logo-link" onClick={closeMenu} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }}>
          {logoUrl && (
            <img
              src={logoUrl}
              alt={logoText}
              className="nav-logo-img"
              style={{ height: '38px', width: 'auto', objectFit: 'contain', display: 'block', borderRadius: '4px' }}
            />
          )}
          <span className="nav-logo">{logoText}</span>
        </Link>

        {/* SEARCH BAR */}
        <div style={{ display: 'none' }} className="desktop-search">
          <AutocompleteSearch />
        </div>
        <style>{`
          @media(min-width: 768px) { .desktop-search { display: block !important; } }
        `}</style>

        {/* NAVIGATION LINKS */}
        <ul className={`nav-links ${isOpen ? 'open' : ''}`}>
          <li>
            <Link href="/" className={isActive('/') ? 'active' : ''} onClick={closeMenu}>
              Catálogo
            </Link>
          </li>
          {user ? (
            <>
              <li>
                <Link
                  href="/my-orders"
                  className={isActive('/my-orders') ? 'active' : ''}
                  onClick={closeMenu}
                >
                  Mis Pedidos
                </Link>
              </li>
              <li>
                <Link
                  href="/profile"
                  className={isActive('/profile') ? 'active' : ''}
                  onClick={closeMenu}
                >
                  Mi Perfil
                </Link>
              </li>
              {(user.role === 'admin' || user.role === 'custom') && (
                <li>
                  <Link href="/admin" className={isActive('/admin') ? 'active' : ''} onClick={closeMenu}>
                    Admin Dashboard
                  </Link>
                </li>
              )}
              {(user.role === 'admin' || user.role === 'vendedor' || user.role === 'custom') && (
                <li>
                  <Link href="/pos" className={isActive('/pos') ? 'active' : ''} onClick={closeMenu}>
                    Punto de Venta
                  </Link>
                </li>
              )}
              <li>
                <button
                  onClick={handleLogout}
                  className="nav-logout-btn"
                >
                  Cerrar Sesión
                </button>
              </li>
            </>
          ) : (
            <li>
              <Link
                href="/login"
                className={isActive('/login') ? 'active' : ''}
                onClick={closeMenu}
              >
                Iniciar Sesión
              </Link>
            </li>
          )}
        </ul>

        {/* ACTIONS */}
        <div className="nav-actions">
          <ThemeToggle />
          
          <button
            onClick={() => setCurrency(currency === 'USD' ? 'VES' : 'USD')}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: '20px',
              padding: '0.35rem 0.65rem',
              color: 'var(--text)',
              fontSize: '0.8rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s',
              outline: 'none'
            }}
            title="Cambiar moneda de visualización"
          >
            {currency === 'USD' ? '💵 USD' : '🇻🇪 VES'}
          </button>
          
          {user ? (
            <Link 
              href="/my-orders" 
              className="btn-icon user-nav-btn" 
              aria-label="Mi cuenta" 
              onClick={closeMenu}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.35rem 0.75rem',
                background: 'rgba(212, 175, 55, 0.08)',
                border: '1px solid rgba(212, 175, 55, 0.25)',
                borderRadius: '20px',
                color: 'var(--text)',
                textDecoration: 'none',
                fontSize: '0.85rem',
                fontWeight: 600,
                transition: 'all 0.2s ease',
              }}
            >
              👤 <span className="nav-user-name" style={{ fontSize: '0.8rem' }}>{user.fullName.split(' ')[0]}</span>
            </Link>
          ) : (
            <Link 
              href="/login" 
              className="btn-icon user-nav-btn" 
              aria-label="Iniciar sesión" 
              onClick={closeMenu}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.35rem 0.75rem',
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: '20px',
                color: 'var(--text)',
                textDecoration: 'none',
                fontSize: '0.85rem',
                fontWeight: 600,
                transition: 'all 0.2s ease',
              }}
            >
              👤 <span className="nav-user-name" style={{ fontSize: '0.8rem' }}>Acceder</span>
            </Link>
          )}

          <Link href="/cart" className="btn-icon cart-badge" aria-label="Ver carrito" onClick={closeMenu}>
            🛒 <span className="nav-btn-text">Carrito</span>
            {cartCount > 0 && <span className="badge">{cartCount}</span>}
          </Link>
        </div>
        <style jsx>{`
          @media(max-width: 576px) {
            .nav-user-name {
              display: none !important;
            }
            .user-nav-btn {
              padding: 0.35rem !important;
              border: none !important;
              background: none !important;
            }
          }
        `}</style>

        {/* HAMBURGER BUTTON */}
        <button
          className={`nav-toggle ${isOpen ? 'active' : ''}`}
          onClick={toggleMenu}
          aria-label="Toggle navigation menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </nav>
  );
}
