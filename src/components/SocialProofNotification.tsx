'use client';

import React, { useState, useEffect } from 'react';
import { useCurrency } from '@/context/CurrencyContext';

export default function SocialProofNotification() {
  const [sales, setSales] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const { formatPriceLocal } = useCurrency();

  useEffect(() => {
    fetch('/api/recent-sales')
      .then(res => res.json() as any)
      .then(data => {
        if (data.success && data.sales) {
          setSales(data.sales);
        }
      })
      .catch(err => console.error('Failed to load recent sales:', err));
  }, []);

  useEffect(() => {
    if (sales.length === 0) return;

    let hideTimer: NodeJS.Timeout;
    const showNextNotification = () => {
      setIsVisible(true);

      hideTimer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => {
          setCurrentIndex(prev => (prev + 1) % sales.length);
        }, 500);
      }, 6000);
    };

    const initialTimer = setTimeout(() => {
      showNextNotification();
    }, 8000);

    const interval = setInterval(() => {
      showNextNotification();
    }, 45000);

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(hideTimer);
      clearInterval(interval);
    };
  }, [sales, currentIndex]);

  if (sales.length === 0 || currentIndex >= sales.length) return null;

  const currentNotification = sales[currentIndex];

  const getMinutesAgo = (timestamp: string) => {
    try {
      const orderDate = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - orderDate.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins <= 0) return 'hace unos instantes';
      if (diffMins < 60) return `hace ${diffMins} min`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `hace ${diffHours} hr`;
      return `hace ${Math.floor(diffHours / 24)} días`;
    } catch {
      return 'hace unos minutos';
    }
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '80px',
      left: '24px',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: '0.8rem',
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderLeft: '4px solid var(--gold)',
      borderRadius: '12px',
      padding: '0.8rem 1.2rem 0.8rem 0.8rem',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      transform: isVisible ? 'translateX(0)' : 'translateX(-120%)',
      opacity: isVisible ? 1 : 0,
      transition: 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      maxWidth: '320px',
      pointerEvents: 'none',
      userSelect: 'none'
    }}>
      <div style={{
        width: '46px',
        height: '46px',
        borderRadius: '8px',
        background: 'var(--bg3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0
      }}>
        {currentNotification.image ? (
          <img
            src={`/api/assets/uploads/${currentNotification.image}`}
            alt={currentNotification.productName}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          '📦'
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <strong>{currentNotification.name}</strong> en {currentNotification.city}
        </div>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '210px' }}>
          Compró {currentNotification.productName}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.72rem' }}>
          <span style={{ color: 'var(--gold)', fontWeight: 'bold' }}>
            {formatPriceLocal(currentNotification.price)}
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            {getMinutesAgo(currentNotification.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}
