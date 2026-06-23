'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useToast } from '@/context/ToastContext';

interface OrderItem {
  order_id: number;
  product_id: number;
  product_name: string;
  price: number;
  quantity: number;
  image: string | null;
  slug: string | null;
}

interface Order {
  id: number;
  order_number: string;
  status: string;
  total: number;
  payment_method: string;
  created_at: string;
  item_count: number;
  is_reviewed: number | boolean;
  items: OrderItem[];
}

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  pending: { label: '⏳ Pendiente', class: 'status-pending' },
  paid: { label: '✅ Pagado', class: 'status-paid' },
  processing: { label: '⚙️ En proceso', class: 'status-processing' },
  shipped: { label: '🚚 Enviado', class: 'status-shipped' },
  delivered: { label: '📦 Entregado', class: 'status-delivered' },
  cancelled: { label: '❌ Cancelado', class: 'status-cancelled' },
};

export default function MyOrdersClient({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const { showToast } = useToast();

  // Modal state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Rating values state: key is productId, value is { rating, comment }
  const [reviewValues, setReviewValues] = useState<Record<number, { rating: number; comment: string }>>({});

  const handleOpenRatingModal = (order: Order) => {
    // Initialize rating values for all products in this order
    const initialReviews: Record<number, { rating: number; comment: string }> = {};
    order.items.forEach(item => {
      initialReviews[item.product_id] = { rating: 5, comment: '' }; // Default to 5 stars
    });
    setReviewValues(initialReviews);
    setSelectedOrder(order);
  };

  const handleSetRating = (productId: number, val: number) => {
    setReviewValues(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        rating: val
      }
    }));
  };

  const handleSetComment = (productId: number, comment: string) => {
    setReviewValues(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        comment
      }
    }));
  };

  const handleSubmitReviews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    setIsSubmitting(true);

    const ratingsPayload = selectedOrder.items.map(item => ({
      productId: item.product_id,
      rating: reviewValues[item.product_id]?.rating || 5,
      comment: reviewValues[item.product_id]?.comment || ''
    }));

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          ratings: ratingsPayload
        })
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar calificaciones');
      }

      showToast('¡Gracias! Tus valoraciones han sido guardadas correctamente.', 'success');
      
      // Update local state to mark this order as reviewed
      setOrders(prev =>
        prev.map(o => (o.id === selectedOrder.id ? { ...o, is_reviewed: 1 } : o))
      );
      
      setSelectedOrder(null);
    } catch (error: any) {
      console.error(error);
      showToast(error.message || 'Error al enviar calificaciones', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      {/* Informative notice for general orders if any of them is delivered and unreviewed */}
      {orders.some(o => o.status === 'delivered' && !o.is_reviewed) && (
        <div 
          className="notification-banner"
          style={{
            background: 'rgba(212, 175, 55, 0.1)',
            border: '1px solid var(--gold)',
            borderRadius: 'var(--radius)',
            padding: '1.2rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            animation: 'pulseGlow 2s infinite alternate'
          }}
        >
          <div style={{ fontSize: '1.8rem' }}>⭐</div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 0.2rem 0', color: 'var(--gold)', fontWeight: 700 }}>¡Tienes pedidos entregados por calificar!</h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text)' }}>
              Tu opinión es muy valiosa para nosotros y ayuda a otros compradores a tomar mejores decisiones.
            </p>
          </div>
        </div>
      )}

      {orders.map((order) => {
        const status = STATUS_LABELS[order.status] || { label: order.status, class: '' };
        const canRate = order.status === 'delivered' && !order.is_reviewed;

        return (
          <div
            key={order.id}
            className="my-order-card"
            style={{
              background: 'var(--bg2)', 
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', 
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                  <strong style={{ color: 'var(--gold)', letterSpacing: '1px', fontSize: '1rem' }}>
                    {order.order_number}
                  </strong>
                  <span className={`status-badge ${status.class}`}>{status.label}</span>
                  {order.is_reviewed ? (
                    <span 
                      className="status-badge"
                      style={{
                        background: 'rgba(46, 204, 113, 0.1)',
                        color: '#2ECC71',
                        border: '1px solid #2ECC71'
                      }}
                    >
                      ⭐ Calificado
                    </span>
                  ) : null}
                </div>
                <p style={{ fontSize: '0.82rem', marginBottom: '0.3rem', color: 'var(--text-muted)' }}>
                  {order.item_count} artículo{order.item_count !== 1 ? 's' : ''} •{' '}
                  {order.payment_method}
                </p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {new Date(order.created_at).toLocaleDateString('es-VE', {
                    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </p>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--gold)', marginBottom: '0.5rem' }}>
                  ${Number(order.total).toFixed(2)}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Link href={`/my-orders/${order.id}`} className="btn-outline" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                    Ver detalle
                  </Link>
                  {canRate && (
                    <button
                      onClick={() => handleOpenRatingModal(order)}
                      className="btn-primary"
                      style={{
                        fontSize: '0.8rem',
                        padding: '0.4rem 0.8rem',
                        background: 'var(--gold)',
                        color: '#000',
                        fontWeight: 700,
                        border: 'none',
                        borderRadius: 'var(--radius)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      ⭐ Calificar Compra
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            {/* Show product list in a neat inline style if they want to quickly see what is inside */}
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.8rem' }}>
              {order.items.map((item, index) => (
                <div 
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'var(--bg3)',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    border: '1px solid var(--border)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {item.image ? (
                    <Image 
                      src={`/api/assets/uploads/${item.image}`} 
                      alt={item.product_name}
                      width={20}
                      height={20}
                      style={{ objectFit: 'cover', borderRadius: '4px' }}
                    />
                  ) : (
                    <span>📦</span>
                  )}
                  <span style={{ color: 'var(--text)' }}>{item.product_name}</span>
                  <span style={{ color: 'var(--text-muted)' }}>x{item.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* RATING MODAL */}
      {selectedOrder && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            backdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.25s ease'
          }}
          onClick={() => setSelectedOrder(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1.2rem 1.5rem',
                borderBottom: '1px solid var(--border)'
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--gold)', fontWeight: 700 }}>
                  ⭐ Calificar Pedido {selectedOrder.order_number}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Por favor valora los productos que has recibido
                </span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '0.2rem'
                }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSubmitReviews} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
                
                {selectedOrder.items.map((item) => {
                  const currentReview = reviewValues[item.product_id] || { rating: 5, comment: '' };
                  
                  return (
                    <div 
                      key={item.product_id}
                      style={{
                        padding: '1rem',
                        background: 'var(--bg3)',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.8rem'
                      }}
                    >
                      {/* Product identity */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '4px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {item.image ? (
                            <Image 
                              src={`/api/assets/uploads/${item.image}`} 
                              alt={item.product_name} 
                              width={48}
                              height={48}
                              style={{ objectFit: 'cover' }}
                            />
                          ) : (
                            <span style={{ fontSize: '1.5rem' }}>📦</span>
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>
                            {item.product_name}
                          </h4>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Cantidad: {item.quantity} • ${Number(item.price).toFixed(2)} c/u
                          </span>
                        </div>
                      </div>

                      {/* Stars Selector */}
                      <div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                          Tu calificación:
                        </span>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          {[1, 2, 3, 4, 5].map((star) => {
                            const active = star <= currentReview.rating;
                            return (
                              <button
                                key={star}
                                type="button"
                                onClick={() => handleSetRating(item.product_id, star)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '1.5rem',
                                  color: active ? 'var(--gold)' : 'var(--border)',
                                  padding: 0,
                                  transition: 'transform 0.1s ease'
                                }}
                                onMouseEnter={(e) => {
                                  (e.target as HTMLElement).style.transform = 'scale(1.2)';
                                }}
                                onMouseLeave={(e) => {
                                  (e.target as HTMLElement).style.transform = 'scale(1)';
                                }}
                                aria-label={`Calificar con ${star} estrellas`}
                              >
                                {active ? '★' : '☆'}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Comment Input */}
                      <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                          Comentario u Opinión (Opcional):
                        </label>
                        <textarea
                          value={currentReview.comment}
                          onChange={(e) => handleSetComment(item.product_id, e.target.value)}
                          placeholder="Cuéntanos qué tal te pareció el producto..."
                          maxLength={500}
                          style={{
                            width: '100%',
                            minHeight: '60px',
                            background: 'var(--bg2)',
                            border: '1px solid var(--border)',
                            borderRadius: '4px',
                            padding: '0.5rem',
                            color: 'var(--text)',
                            fontSize: '0.85rem',
                            resize: 'vertical',
                            fontFamily: 'inherit'
                          }}
                        />
                      </div>
                    </div>
                  );
                })}

              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: '1rem 1.5rem',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  background: 'var(--bg3)',
                  borderBottomLeftRadius: 'var(--radius)',
                  borderBottomRightRadius: 'var(--radius)'
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="btn-outline"
                  disabled={isSubmitting}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmitting}
                  style={{
                    padding: '0.5rem 1.2rem',
                    fontSize: '0.9rem',
                    background: 'var(--gold)',
                    color: '#000',
                    fontWeight: 700,
                    border: 'none',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer'
                  }}
                >
                  {isSubmitting ? 'Guardando...' : 'Enviar Calificaciones'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Basic responsive animations embedded */}
      <style jsx global>{`
        @keyframes pulseGlow {
          from {
            box-shadow: 0 0 5px rgba(212, 175, 55, 0.2);
          }
          to {
            box-shadow: 0 0 15px rgba(212, 175, 55, 0.4);
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
