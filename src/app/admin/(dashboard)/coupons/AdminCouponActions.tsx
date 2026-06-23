'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/context/ToastContext';
import ConfirmDialog from '@/components/ConfirmDialog';

interface Coupon {
  id: number; code: string; discount_type: string; discount_value: number;
  min_order: number; uses_left: number | null; is_active: number;
  expires_at: string | null; created_at: string;
}

const EMPTY_FORM = { code: '', discount_type: 'percent', discount_value: '', min_order: '0', uses_left: '', expires_at: '', is_active: true };

export default function AdminCouponActions({ coupons }: { coupons: Coupon[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          discount_value: parseFloat(form.discount_value),
          min_order: parseFloat(form.min_order),
          uses_left: form.uses_left ? parseInt(form.uses_left) : null,
          expires_at: form.expires_at || null
        }),
      });
      const data = await res.json() as any;
      if (res.ok) {
        showToast('✅ Cupón creado.', 'success');
        setShowModal(false);
        setForm({ ...EMPTY_FORM });
        router.refresh();
      } else {
        showToast(data.error || 'Error.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al crear el cupón.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, code: string, isMobile: boolean = false) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Cupón',
      message: `¿Estás seguro de que deseas eliminar permanentemente el cupón "${code}"? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setDeletingId(id);
        try {
          const res = await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE' });
          if (res.ok) {
            showToast('Cupón eliminado.', 'success');
            if (isMobile) {
              setSelectedCoupon(null);
            }
            router.refresh();
          } else {
            showToast('Error al eliminar.', 'error');
          }
        } catch (err) {
          console.error(err);
          showToast('Error de red al eliminar.', 'error');
        } finally {
          setDeletingId(null);
        }
      }
    });
  };

  const handleToggle = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/coupons/${id}/toggle`, { method: 'PUT' });
      const data = await res.json() as any;
      if (res.ok) {
        showToast(data.message, 'success');
        router.refresh();
      } else {
        showToast(data.error || 'Error.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al actualizar estado.', 'error');
    }
  };

  return (
    <>
      <div className="admin-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', marginTop: '1rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-muted)', margin: 0 }}>Lista de Cupones</h2>
        <button onClick={() => { setForm({ ...EMPTY_FORM }); setShowModal(true); }} className="btn-primary" style={{ fontSize: '0.85rem', padding: '0.6rem 1.2rem' }}>
          + Nuevo Cupón
        </button>
      </div>

      <div className="desktop-only table-card">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Descuento</th>
              <th>Mínimo de Compra</th>
              <th>Usos Restantes</th>
              <th>Fecha de Expiración</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {coupons.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                  No hay cupones registrados.
                </td>
              </tr>
            ) : (
              coupons.map(c => (
                <tr key={c.id}>
                  <td>
                    <code style={{ background: 'var(--bg3)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.9rem', color: 'var(--gold)' }}>
                      {c.code}
                    </code>
                  </td>
                  <td>
                    {c.discount_type === 'percent' ? `${c.discount_value}%` : `$${Number(c.discount_value).toFixed(2)}`}
                  </td>
                  <td>
                    ${Number(c.min_order).toFixed(2)}
                  </td>
                  <td>
                    {c.uses_left === null ? 'Ilimitado' : c.uses_left}
                  </td>
                  <td>
                    {c.expires_at ? new Date(c.expires_at).toLocaleString('es-VE') : 'Nunca'}
                  </td>
                  <td>
                    <span
                      onClick={() => handleToggle(c.id)}
                      className={`status-badge ${c.is_active === 1 ? 'status-paid' : 'status-cancelled'}`}
                      style={{ cursor: 'pointer' }}
                      title="Haga clic para activar/desactivar"
                    >
                      {c.is_active === 1 ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => handleDelete(c.id, c.code, false)}
                      disabled={deletingId === c.id}
                      className="btn-icon"
                      style={{ color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      {deletingId === c.id ? '...' : '🗑️'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mobile-only mobile-card-grid">
        {coupons.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem', background: 'var(--bg2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            No hay cupones registrados.
          </div>
        ) : (
          coupons.map(c => (
            <div key={c.id} className="mobile-data-card" onClick={() => setSelectedCoupon(c)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <code style={{ background: 'var(--bg3)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.9rem', color: 'var(--gold)', fontWeight: 700 }}>
                  {c.code}
                </code>
                <span className={`status-badge ${c.is_active === 1 ? 'status-paid' : 'status-cancelled'}`} style={{ transform: 'scale(0.85)', transformOrigin: 'right center' }}>
                  {c.is_active === 1 ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.8rem', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Mínimo: ${Number(c.min_order).toFixed(2)}</span>
                <strong style={{ color: 'var(--text)', fontSize: '0.88rem' }}>
                  {c.discount_type === 'percent' ? `${c.discount_value}%` : `$${Number(c.discount_value).toFixed(2)}`}
                </strong>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedCoupon && (
        <div className="drawer-backdrop" onClick={() => setSelectedCoupon(null)}>
          <div className="drawer-content" onClick={e => e.stopPropagation()}>
            <div className="drawer-handle" />
            <button className="drawer-close-btn" onClick={() => setSelectedCoupon(null)}>✕</button>
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.2rem', fontWeight: 700, color: 'var(--gold)' }}>🎫 Detalle del Cupón</h3>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Código del Cupón</span>
              <span className="drawer-detail-value">
                <code style={{ background: 'var(--bg3)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontFamily: 'monospace', fontSize: '1.05rem', color: 'var(--gold)', fontWeight: 700 }}>
                  {selectedCoupon.code}
                </code>
              </span>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Descuento</span>
              <span className="drawer-detail-value" style={{ fontWeight: 700 }}>
                {selectedCoupon.discount_type === 'percent' ? `${selectedCoupon.discount_value}%` : `$${Number(selectedCoupon.discount_value).toFixed(2)}`}
              </span>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Mínimo de Compra</span>
              <span className="drawer-detail-value">${Number(selectedCoupon.min_order).toFixed(2)}</span>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Usos Restantes</span>
              <span className="drawer-detail-value">{selectedCoupon.uses_left === null ? 'Ilimitado' : selectedCoupon.uses_left}</span>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Expiración</span>
              <span className="drawer-detail-value">{selectedCoupon.expires_at ? new Date(selectedCoupon.expires_at).toLocaleString('es-VE') : 'Nunca'}</span>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Estado</span>
              <span className="drawer-detail-value">
                <span className={`status-badge ${selectedCoupon.is_active === 1 ? 'status-paid' : 'status-cancelled'}`}>
                  {selectedCoupon.is_active === 1 ? 'Activo' : 'Inactivo'}
                </span>
              </span>
            </div>

            {/* Actions for coupon in Mobile Detail view */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1.8rem', paddingTop: '1.2rem', borderTop: '1px solid var(--border)' }}>
              <button
                onClick={async () => {
                  await handleToggle(selectedCoupon.id);
                  setSelectedCoupon(prev => prev ? { ...prev, is_active: prev.is_active === 1 ? 0 : 1 } : null);
                }}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '0.8rem',
                  fontSize: '0.9rem',
                  justifyContent: 'center',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  background: selectedCoupon.is_active === 1 ? 'rgba(231,76,60,0.1)' : 'rgba(46,204,113,0.1)',
                  color: selectedCoupon.is_active === 1 ? 'var(--error)' : 'var(--success)',
                  border: selectedCoupon.is_active === 1 ? '1px solid var(--error)' : '1px solid var(--success)'
                }}
              >
                {selectedCoupon.is_active === 1 ? '🔕 Desactivar Cupón' : '👁️ Activar Cupón'}
              </button>

              <button
                onClick={() => handleDelete(selectedCoupon.id, selectedCoupon.code, true)}
                disabled={deletingId === selectedCoupon.id}
                className="tbl-action"
                style={{
                  width: '100%',
                  padding: '0.8rem',
                  fontSize: '0.9rem',
                  justifyContent: 'center',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(231, 76, 60, 0.1)',
                  color: 'var(--error)',
                  border: '1px solid var(--error)'
                }}
              >
                🗑️ Eliminar Cupón
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>🎫 Crear Nuevo Cupón</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', marginTop: '1rem' }}>
              <div className="form-row">
                <div className="form-group">
                  <label>Código del Cupón *</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    required
                    placeholder="E.g. DESCUENTO20"
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>
                <div className="form-group">
                  <label>Tipo de Descuento</label>
                  <select value={form.discount_type} onChange={e => setForm(f => ({ ...f, discount_type: e.target.value }))}>
                    <option value="percent">Porcentaje (%)</option>
                    <option value="fixed">Monto fijo ($)</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Valor *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.discount_value}
                    onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))}
                    required
                    placeholder={form.discount_type === 'percent' ? '20' : '5.00'}
                  />
                </div>
                <div className="form-group">
                  <label>Orden mínima ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.min_order}
                    onChange={e => setForm(f => ({ ...f, min_order: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Usos disponibles (vacío = ilimitado)</label>
                  <input
                    type="number"
                    min="1"
                    value={form.uses_left}
                    onChange={e => setForm(f => ({ ...f, uses_left: e.target.value }))}
                    placeholder="100"
                  />
                </div>
                <div className="form-group">
                  <label>Fecha de expiración</label>
                  <input
                    type="datetime-local"
                    value={form.expires_at}
                    onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }} disabled={saving}>
                {saving ? 'Guardando...' : '✅ Crear Cupón'}
              </button>
            </form>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText="Eliminar"
        cancelText="Cancelar"
        isDanger={true}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </>
  );
}
