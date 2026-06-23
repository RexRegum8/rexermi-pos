'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { useCurrency } from '@/context/CurrencyContext';

export default function CartPage() {
  const { cart, updateQuantity, removeFromCart, cartTotal, cartCount } = useCart();
  const { showToast } = useToast();
  const { formatPriceLocal } = useCurrency();
  const hasVariablePrice = cart.some(item => item.price_type === 'base' || item.price_type === 'range');

  const handleQtyChange = (id: number, currentQty: number, change: number, name: string) => {
    const newQty = currentQty + change;
    updateQuantity(id, newQty);
    if (change > 0) {
      showToast(`Aumentaste la cantidad de ${name}`, 'info');
    } else if (change < 0 && newQty > 0) {
      showToast(`Disminuiste la cantidad de ${name}`, 'info');
    }
  };

  const handleRemove = (id: number, name: string) => {
    removeFromCart(id);
    showToast(`Eliminaste ${name} del carrito`, 'info');
  };

  return (
    <section className="section">
      <div className="section-inner">
        <div className="page-hero" style={{ padding: '2rem 1rem', textAlign: 'center', background: 'none' }}>
          <span className="section-tag">Tu Compra</span>
          <h1>🛒 Mi Carrito</h1>
          <p>Revisa y edita los productos seleccionados antes de pagar</p>
        </div>

        {cart.length === 0 ? (
          <div className="empty-state" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '4rem 2rem' }}>
            <div className="empty-icon" style={{ fontSize: '4rem', marginBottom: '1rem' }}>🛒</div>
            <h3>Tu carrito está vacío</h3>
            <p style={{ marginBottom: '2rem' }}>Agrega productos o servicios desde nuestra tienda para comenzar.</p>
            <Link href="/" className="btn-primary">
              🏪 Ir a la Tienda
            </Link>
          </div>
        ) : (
          <div className="cart-layout">
            {/* Cart Items List */}
            <div className="cart-items">
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
                <span>Producto / Servicio</span>
                <span className="hide-mobile">Subtotal</span>
              </div>
              {cart.map((item) => (
                <div key={item.id} className="cart-item">
                  <div className="cart-item-img" style={{ position: 'relative' }}>
                    {item.image ? (
                      <Image
                        src={`/api/assets/uploads/${item.image}`}
                        alt={item.name}
                        fill
                        sizes="80px"
                        style={{ objectFit: 'cover', borderRadius: '8px' }}
                      />
                    ) : (
                      '📦'
                    )}
                  </div>
                  
                  <div className="cart-item-info">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span className="cart-item-cat">
                          {item.type === 'service' ? '🟢 Servicio' : '🔵 Producto'}
                        </span>
                        <h4 className="cart-item-name">
                          {item.name}
                          {item.price_type === 'base' && (
                            <span className="price-type-badge base" style={{
                              marginLeft: '0.5rem',
                              fontSize: '0.7rem',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              background: 'rgba(235, 94, 40, 0.15)',
                              color: '#eb5e28',
                              border: '1px solid rgba(235, 94, 40, 0.3)',
                              fontWeight: 600,
                              display: 'inline-block',
                              verticalAlign: 'middle'
                            }}>
                              Precio Base
                            </span>
                          )}
                          {item.price_type === 'range' && (
                            <span className="price-type-badge variable" style={{
                              marginLeft: '0.5rem',
                              fontSize: '0.7rem',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              background: 'rgba(58, 125, 68, 0.15)',
                              color: '#3a7d44',
                              border: '1px solid rgba(58, 125, 68, 0.3)',
                              fontWeight: 600,
                              display: 'inline-block',
                              verticalAlign: 'middle'
                            }}>
                              Precio Variable
                            </span>
                          )}
                        </h4>
                      </div>
                      <button
                        onClick={() => handleRemove(item.id, item.name)}
                        className="remove-btn"
                        title="Eliminar producto"
                        aria-label={`Eliminar ${item.name}`}
                      >
                        🗑️
                      </button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.8rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div className="qty-control">
                        <button
                          onClick={() => handleQtyChange(item.id, item.quantity, -1, item.name)}
                          className="qty-btn"
                          aria-label="Disminuir cantidad"
                          disabled={item.quantity <= 1}
                        >
                          -
                        </button>
                        <span className="qty-val">{item.quantity}</span>
                        <button
                          onClick={() => handleQtyChange(item.id, item.quantity, 1, item.name)}
                          className="qty-btn"
                          aria-label="Aumentar cantidad"
                          disabled={item.type === 'product' && item.quantity >= item.stock}
                        >
                          +
                        </button>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>
                          Precio unitario:{' '}
                          {item.price_type === 'base' && 'Desde '}
                          {formatPriceLocal(item.price)}
                          {item.price_type === 'range' && item.price_max ? ` - ${formatPriceLocal(item.price_max)}` : ''}
                        </span>
                        <span className="cart-item-price">
                          {(item.price_type === 'base' || item.price_type === 'range') && 'Desde '}
                          {formatPriceLocal(item.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Cart Summary Card */}
            <div className="cart-summary">
              <h3>Resumen del Pedido</h3>
              <div className="glow-line" style={{ marginBottom: '1.2rem' }}></div>
              
              <div className="summary-row">
                <span>Productos ({cartCount})</span>
                <span>
                  {hasVariablePrice && 'Desde '}
                  {formatPriceLocal(cartTotal)}
                </span>
              </div>
              <div className="summary-row">
                <span>Envío</span>
                <span style={{ color: 'var(--success)' }}>Por acordar / Pago a destino</span>
              </div>
              
              <div className="summary-total" style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1rem', display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 'bold' }}>
                <span>Total</span>
                <span>
                  {hasVariablePrice && 'Desde '}
                  {formatPriceLocal(cartTotal)}
                </span>
              </div>

              {hasVariablePrice && (
                <div style={{
                  marginTop: '1.2rem',
                  padding: '0.8rem',
                  borderRadius: '8px',
                  background: 'rgba(235, 94, 40, 0.1)',
                  border: '1px solid rgba(235, 94, 40, 0.2)',
                  color: 'var(--primary, #eb5e28)',
                  fontSize: '0.82rem',
                  lineHeight: 1.4,
                  textAlign: 'center'
                }}>
                  ℹ️ Uno o más ítems tienen precio variable. El total final se acordará con el vendedor.
                </div>
              )}

              <div style={{ marginTop: '1.5rem' }}>
                <Link href="/checkout" className="btn-primary" style={{ display: 'flex', width: '100%', justifyContent: 'center' }}>
                  💳 Proceder al Pago
                </Link>
                <Link href="/" className="btn-outline" style={{ display: 'flex', width: '100%', justifyContent: 'center', marginTop: '0.8rem' }}>
                  🛍️ Seguir Comprando
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
