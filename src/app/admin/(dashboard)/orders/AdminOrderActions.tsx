'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/context/ToastContext';

const STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];
const STATUS_LABELS: Record<string, string> = {
  pending: '⏳ Pendiente', paid: '✅ Pagado', processing: '⚙️ Procesando',
  shipped: '🚚 Enviado', delivered: '📦 Entregado', cancelled: '❌ Cancelado',
};

export default function AdminOrderActions({ orderId, currentStatus }: { orderId: number; currentStatus: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    setOpen(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json() as any;
      if (res.ok) {
        showToast(`Estado actualizado a: ${STATUS_LABELS[newStatus]}`, 'success');
        router.refresh();
      } else {
        showToast(data.error || 'Error.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al cambiar estado.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        className="tbl-action tbl-edit"
        style={{ cursor: 'pointer' }}
      >
        {loading ? '...' : '🔄 Estado ▾'}
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '110%', background: 'var(--bg2)',
          border: '1px solid var(--border)', borderRadius: '10px', padding: '0.4rem',
          zIndex: 100, minWidth: '170px', boxShadow: 'var(--shadow)'
        }}>
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '0.5rem 0.8rem', background: s === currentStatus ? 'rgba(212,175,55,0.12)' : 'none',
                border: 'none', color: s === currentStatus ? 'var(--gold)' : 'var(--text)',
                cursor: 'pointer', fontSize: '0.82rem', borderRadius: '6px'
              }}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
