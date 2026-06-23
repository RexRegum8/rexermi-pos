'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { useToast } from '@/context/ToastContext';
import ConfirmDialog from '@/components/ConfirmDialog';

interface Review {
  id: number;
  user_id: number;
  product_id: number;
  order_id: number;
  rating: number;
  comment: string | null;
  status: 'approved' | 'hidden';
  created_at: string;
  product_name: string;
  product_slug: string;
  product_image: string | null;
  user_name: string;
  user_email: string;
  order_number: string;
}

export default function ReviewsClient({ initialReviews }: { initialReviews: Review[] }) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const { showToast } = useToast();
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

  // Filter and Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [starFilter, setStarFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Moderate review status
  const handleToggleStatus = async (reviewId: number, currentStatus: 'approved' | 'hidden') => {
    const newStatus = currentStatus === 'approved' ? 'hidden' : 'approved';
    try {
      const res = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || 'Error al actualizar calificación');

      showToast(`Opinión ${newStatus === 'hidden' ? 'ocultada' : 'aprobada'} con éxito.`, 'success');
      
      setReviews(prev =>
        prev.map(r => (r.id === reviewId ? { ...r, status: newStatus } : r))
      );
    } catch (error: any) {
      console.error(error);
      showToast(error.message || 'Error al actualizar', 'error');
    }
  };

  // Delete review permanently
  const handleDeleteReview = (reviewId: number) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Calificación',
      message: '¿Estás seguro de que deseas eliminar permanentemente esta calificación? Esta acción no se puede deshacer.',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          const res = await fetch(`/api/admin/reviews/${reviewId}`, {
            method: 'DELETE'
          });

          const data = (await res.json()) as any;
          if (!res.ok) throw new Error(data.error || 'Error al eliminar calificación');

          showToast('Calificación eliminada permanentemente.', 'success');
          setReviews(prev => prev.filter(r => r.id !== reviewId));
        } catch (error: any) {
          console.error(error);
          showToast(error.message || 'Error al eliminar', 'error');
        }
      }
    });
  };

  // Filtered reviews
  const filteredReviews = useMemo(() => {
    return reviews.filter(r => {
      // 1. Search Query
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = q === '' ||
        r.product_name.toLowerCase().includes(q) ||
        r.user_name.toLowerCase().includes(q) ||
        r.user_email.toLowerCase().includes(q) ||
        r.order_number.toLowerCase().includes(q) ||
        (r.comment && r.comment.toLowerCase().includes(q));

      // 2. Star Rating Filter
      const matchStar = starFilter === 'all' || r.rating.toString() === starFilter;

      // 3. Status Filter
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;

      return matchSearch && matchStar && matchStatus;
    });
  }, [reviews, searchQuery, starFilter, statusFilter]);

  return (
    <div style={{ animation: 'fadeInUp 0.3s ease both' }}>
      
      {/* Search & Filters Row */}
      <div 
        style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1.5rem',
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '1rem',
          alignItems: 'center'
        }}
      >
        {/* Search Input */}
        <div style={{ flex: 1, minWidth: '220px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por cliente, producto, orden o comentario..."
            style={{
              width: '100%',
              padding: '0.6rem 1rem',
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              color: 'var(--text)',
              fontSize: '0.85rem'
            }}
          />
        </div>

        {/* Rating Filter */}
        <div style={{ minWidth: '150px' }}>
          <select
            value={starFilter}
            onChange={(e) => setStarFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem 1rem',
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              color: 'var(--text)',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            <option value="all">⭐ Todas las Estrellas</option>
            <option value="5">⭐⭐⭐⭐⭐ 5 Estrellas</option>
            <option value="4">⭐⭐⭐⭐ 4 Estrellas</option>
            <option value="3">⭐⭐⭐ 3 Estrellas</option>
            <option value="2">⭐⭐ 2 Estrellas</option>
            <option value="1">⭐ 1 Estrella</option>
          </select>
        </div>

        {/* Status Filter */}
        <div style={{ minWidth: '140px' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem 1rem',
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              color: 'var(--text)',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            <option value="all">👁️ Todos los Estados</option>
            <option value="approved">Permitidos (Aprobados)</option>
            <option value="hidden">Ocultos</option>
          </select>
        </div>

        {/* Clear Filters Button */}
        {(searchQuery || starFilter !== 'all' || statusFilter !== 'all') && (
          <button
            onClick={() => {
              setSearchQuery('');
              setStarFilter('all');
              setStatusFilter('all');
            }}
            className="btn-outline"
            style={{
              padding: '0.6rem 1rem',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* DESKTOP TABLE VIEW */}
      <div className="desktop-only table-card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '1rem' }}>Producto</th>
              <th style={{ textAlign: 'left', padding: '1rem' }}>Cliente</th>
              <th style={{ textAlign: 'center', padding: '1rem', width: '120px' }}>Valoración</th>
              <th style={{ textAlign: 'left', padding: '1rem' }}>Comentario</th>
              <th style={{ textAlign: 'center', padding: '1rem', width: '110px' }}>Estado</th>
              <th style={{ textAlign: 'right', padding: '1rem', width: '200px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredReviews.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  🔍 No se encontraron calificaciones con los criterios seleccionados.
                </td>
              </tr>
            ) : (
              filteredReviews.map((rev) => (
                <tr key={rev.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  
                  {/* Product Info */}
                  <td style={{ padding: '0.8rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {rev.product_image ? (
                        <Image 
                          src={`/api/assets/uploads/${rev.product_image}`} 
                          alt={rev.product_name} 
                          width={32}
                          height={32}
                          style={{ borderRadius: '4px', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                          📦
                        </div>
                      )}
                      <div>
                        <strong style={{ color: 'var(--text)', fontSize: '0.85rem', display: 'block' }}>
                          {rev.product_name}
                        </strong>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          Pedido: {rev.order_number}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Client Info */}
                  <td style={{ padding: '0.8rem 1rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{rev.user_name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{rev.user_email}</div>
                  </td>

                  {/* Rating */}
                  <td style={{ padding: '0.8rem 1rem', textAlign: 'center' }}>
                    <div style={{ color: 'var(--gold)', letterSpacing: '1px', fontSize: '0.9rem' }}>
                      {'★'.repeat(rev.rating) + '☆'.repeat(5 - rev.rating)}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>({rev.rating}/5)</span>
                  </td>

                  {/* Comment */}
                  <td style={{ padding: '0.8rem 1rem', maxWidth: '300px' }}>
                    {rev.comment ? (
                      <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.4, wordBreak: 'break-word', color: 'var(--text)' }}>
                        {rev.comment}
                      </p>
                    ) : (
                      <span style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        Sin comentario escrito.
                      </span>
                    )}
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.3rem' }}>
                      {new Date(rev.created_at).toLocaleDateString('es-VE')}
                    </span>
                  </td>

                  {/* Status Badge */}
                  <td style={{ padding: '0.8rem 1rem', textAlign: 'center' }}>
                    {rev.status === 'approved' ? (
                      <span 
                        className="status-badge"
                        style={{
                          background: 'rgba(46, 204, 113, 0.1)',
                          color: '#2ECC71',
                          border: '1px solid #2ECC71',
                          fontSize: '0.75rem',
                          padding: '2px 8px'
                        }}
                      >
                        Permitido
                      </span>
                    ) : (
                      <span 
                        className="status-badge"
                        style={{
                          background: 'rgba(231, 76, 60, 0.1)',
                          color: '#E74C3C',
                          border: '1px solid #E74C3C',
                          fontSize: '0.75rem',
                          padding: '2px 8px'
                        }}
                      >
                        Oculto
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '0.8rem 1rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleToggleStatus(rev.id, rev.status)}
                        className="btn-outline"
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.35rem 0.7rem',
                          borderColor: rev.status === 'approved' ? 'var(--error)' : 'var(--gold)',
                          color: rev.status === 'approved' ? 'var(--error)' : 'var(--gold)',
                        }}
                      >
                        {rev.status === 'approved' ? '🙈 Ocultar' : '👁️ Permitir'}
                      </button>
                      <button
                        onClick={() => handleDeleteReview(rev.id)}
                        className="btn-outline"
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.35rem 0.7rem',
                          borderColor: '#C0392B',
                          color: '#C0392B',
                          background: 'rgba(192, 57, 43, 0.05)'
                        }}
                      >
                        🗑️ Borrar
                      </button>
                    </div>
                  </td>

                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MOBILE LIST CARDS VIEW */}
      <div className="mobile-only">
        {filteredReviews.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)' }}>
            🔍 No se encontraron calificaciones.
          </div>
        ) : (
          <div className="mobile-card-grid" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredReviews.map((rev) => (
              <div 
                key={rev.id}
                className="mobile-data-card"
                style={{
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '1.2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.8rem'
                }}
              >
                
                {/* Header: Product & Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {rev.product_image ? (
                      <Image 
                        src={`/api/assets/uploads/${rev.product_image}`} 
                        alt={rev.product_name} 
                        width={28}
                        height={28}
                        style={{ borderRadius: '4px', objectFit: 'cover' }}
                      />
                    ) : (
                      <span>📦</span>
                    )}
                    <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '0.82rem' }}>
                      {rev.product_name}
                    </span>
                  </div>
                  {rev.status === 'approved' ? (
                    <span style={{ fontSize: '0.7rem', padding: '1px 6px', background: 'rgba(46, 204, 113, 0.1)', color: '#2ECC71', border: '1px solid #2ECC71', borderRadius: '4px' }}>
                      Permitido
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.7rem', padding: '1px 6px', background: 'rgba(231, 76, 60, 0.1)', color: '#E74C3C', border: '1px solid #E74C3C', borderRadius: '4px' }}>
                      Oculto
                    </span>
                  )}
                </div>

                {/* Rating */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ color: 'var(--gold)', letterSpacing: '1px', fontSize: '0.85rem' }}>
                    {'★'.repeat(rev.rating) + '☆'.repeat(5 - rev.rating)}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>({rev.rating}/5)</span>
                </div>

                {/* Comment */}
                <div style={{ background: 'var(--bg3)', padding: '0.6rem 0.8rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  {rev.comment ? (
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text)', lineHeight: 1.4 }}>
                      "{rev.comment}"
                    </p>
                  ) : (
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Sin comentario escrito.
                    </p>
                  )}
                </div>

                {/* Client Info and Date */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <div>
                    <span>Por: <strong>{rev.user_name}</strong></span>
                    <span style={{ display: 'block', fontSize: '0.68rem' }}>({rev.user_email})</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span>Orden: {rev.order_number}</span>
                    <span style={{ display: 'block', fontSize: '0.68rem' }}>{new Date(rev.created_at).toLocaleDateString('es-VE')}</span>
                  </div>
                </div>

                {/* Actions Footer */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', borderTop: '1px solid var(--border)', paddingTop: '0.8rem' }}>
                  <button
                    onClick={() => handleToggleStatus(rev.id, rev.status)}
                    className="btn-outline"
                    style={{
                      flex: 1,
                      fontSize: '0.75rem',
                      padding: '0.4rem',
                      textAlign: 'center',
                      borderColor: rev.status === 'approved' ? 'var(--error)' : 'var(--gold)',
                      color: rev.status === 'approved' ? 'var(--error)' : 'var(--gold)',
                    }}
                  >
                    {rev.status === 'approved' ? '🙈 Ocultar' : '👁️ Permitir'}
                  </button>
                  <button
                    onClick={() => handleDeleteReview(rev.id)}
                    className="btn-outline"
                    style={{
                      flex: 1,
                      fontSize: '0.75rem',
                      padding: '0.4rem',
                      textAlign: 'center',
                      borderColor: '#C0392B',
                      color: '#C0392B',
                      background: 'rgba(192, 57, 43, 0.05)'
                    }}
                  >
                    🗑️ Eliminar
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
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
    </div>
  );
}
