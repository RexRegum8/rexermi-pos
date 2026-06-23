'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/context/ToastContext';

export default function POSLogoutButton() {
  const router = useRouter();
  const { showToast } = useToast();

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        window.location.href = '/login';
      } else {
        showToast('Error al cerrar sesión', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al cerrar sesión', 'error');
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="pos-logout-btn"
      style={{
        background: 'rgba(231, 76, 60, 0.08)',
        border: '1px solid rgba(231, 76, 60, 0.3)',
        color: '#ff4d4f',
        padding: '0.45rem 1.2rem',
        borderRadius: '8px',
        fontSize: '0.85rem',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      Cerrar Sesión
    </button>
  );
}
