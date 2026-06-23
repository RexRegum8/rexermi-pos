'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/context/ToastContext';
import Link from 'next/link';

export default function AdminProductActions({ id, isActive }: { id: number; isActive: boolean }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/products/${id}/toggle`, { method: 'PUT' });
      const data = (await res.json()) as any;
      if (res.ok) { showToast(data.message, 'success'); router.refresh(); }
      else showToast(data.error || 'Error.', 'error');
    } catch { showToast('Error de red.', 'error'); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    setLoading(true);
    setConfirmDelete(false);
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
      const data = (await res.json()) as any;
      if (res.ok) { showToast('Producto eliminado.', 'success'); router.refresh(); }
      else showToast(data.error || 'Error.', 'error');
    } catch { showToast('Error de red.', 'error'); }
    finally { setLoading(false); }
  };

  if (confirmDelete) {
    return (
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>¿Eliminar?</span>
        <button onClick={handleDelete} disabled={loading} className="tbl-action tbl-delete" style={{ cursor: 'pointer' }}>
          {loading ? '...' : '✓ Sí'}
        </button>
        <button onClick={() => setConfirmDelete(false)} className="tbl-action" style={{ cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)' }}>
          ✕ No
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
      <Link href={`/admin/products/${id}/edit`} className="tbl-action tbl-edit">✏️ Editar</Link>
      <button onClick={handleToggle} disabled={loading} className="tbl-action tbl-view" style={{ cursor: 'pointer', border: '1px solid rgba(52,152,219,0.3)', background: 'rgba(52,152,219,0.07)', color: '#3498DB' }}>
        {isActive ? '🖕 Ocultar' : '👁️ Activar'}
      </button>
      <button onClick={() => setConfirmDelete(true)} disabled={loading} className="tbl-action tbl-delete" style={{ cursor: 'pointer' }}>
        🗑️
      </button>
    </div>
  );
}
