'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import Link from 'next/link';

interface CouponInfo {
  id: number;
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
}

function isStoreOpen(settings: Record<string, string>): boolean {
  const mode = settings['store_status_mode'] || 'manual';
  if (mode === 'manual') {
    return settings['store_open'] !== '0';
  }

  // Scheduled mode
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const allowedDays = (settings['store_schedule_days'] || '').split(',').map(Number);

  if (!allowedDays.includes(currentDay)) {
    return false;
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const startStr = settings['store_schedule_start'] || '08:00';
  const endStr = settings['store_schedule_end'] || '18:00';
  const [startH, startM] = startStr.split(':').map(Number);
  const [endH, endM] = endStr.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (endMinutes < startMinutes) {
    // Overnight schedule (e.g., 22:00 to 06:00)
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, cartTotal, clearCart, refreshCartPrices } = useCart();
  const { showToast } = useToast();
  const hasVariablePrice = cart.some(item => item.price_type === 'base' || item.price_type === 'range');

  const [loading, setLoading] = useState(false);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponInfo | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(true);
  const [paymentRef, setPaymentRef] = useState('');
  const [customerMessage, setCustomerMessage] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [selectedShippingMethod, setSelectedShippingMethod] = useState('');
  const [shippingMethods, setShippingMethods] = useState<any[]>([]);
  const [shippingMethodsLoading, setShippingMethodsLoading] = useState(true);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [customerCredit, setCustomerCredit] = useState<any>(null);

  const selectedMethodObj = paymentMethods.find(m => String(m.id) === String(paymentMethod));
  const requiresProof = selectedMethodObj ? selectedMethodObj.requires_proof : false;

  const selectedShippingObj = shippingMethods.find(sm => String(sm.id) === String(selectedShippingMethod));
  const shippingCost = selectedShippingObj ? selectedShippingObj.cost : 0;
  const finalTotal = Math.max(0, cartTotal - discountAmount + shippingCost);

  // M-13 fix: Check auth status on load, redirect before showing form
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.replace(`/login?redirect=/checkout`);
          return;
        }
      } catch {
        router.replace(`/login?redirect=/checkout`);
        return;
      }
      setIsAuthChecked(true);
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (isAuthChecked) {
      const fetchCustomerCredit = async () => {
        try {
          const res = await fetch('/api/customer/credit');
          const data = (await res.json()) as any;
          if (data.success) {
            setCustomerCredit(data);
          }
        } catch (err) {
          console.error('Failed to load customer credit:', err);
        }
      };
      fetchCustomerCredit();
    }
  }, [isAuthChecked]);

  useEffect(() => {
    // Refresh cart prices from database to ensure no stale pricing
    refreshCartPrices();

    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        const data = (await res.json()) as any;
        if (data.success) {
          setSettings(data.settings);
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    };
    fetchSettings();
  }, [refreshCartPrices]);

  useEffect(() => {
    const fetchPaymentMethods = async () => {
      try {
        const res = await fetch('/api/payment-methods');
        const data = (await res.json()) as any;
        if (data.success && data.paymentMethods) {
          setPaymentMethods(data.paymentMethods);
          if (data.paymentMethods.length > 0) {
            setPaymentMethod(String(data.paymentMethods[0].id));
          }
        }
      } catch (err) {
        console.error('Failed to load payment methods:', err);
      } finally {
        setPaymentMethodsLoading(false);
      }
    };

    const fetchShippingMethods = async () => {
      try {
        const res = await fetch('/api/shipping-methods');
        const data = (await res.json()) as any;
        if (data.success && data.shippingMethods) {
          setShippingMethods(data.shippingMethods);
          if (data.shippingMethods.length > 0) {
            setSelectedShippingMethod(String(data.shippingMethods[0].id));
          }
        }
      } catch (err) {
        console.error('Failed to load shipping methods:', err);
      } finally {
        setShippingMethodsLoading(false);
      }
    };

    fetchPaymentMethods();
    fetchShippingMethods();
  }, []);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    try {
      const res = await fetch(`/api/coupon/validate?code=${encodeURIComponent(couponCode)}&total=${cartTotal}`);
      const data = (await res.json()) as any;
      if (!res.ok) {
        showToast(data.error || 'Cupón inválido.', 'error');
        setAppliedCoupon(null);
        setDiscountAmount(0);
      } else {
        setAppliedCoupon(data.coupon);
        setDiscountAmount(data.discount_amount);
        showToast(`✅ Cupón aplicado! Descuento: $${data.discount_amount.toFixed(2)}`, 'success');
      }
    } catch {
      showToast('Error al verificar cupón.', 'error');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('El archivo no puede superar 5 MB.', 'error');
        return;
      }
      setReceiptFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => setReceiptPreview(ev.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        setReceiptPreview(null);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isPickup = selectedShippingObj?.name.toLowerCase().includes('retiro');
    if (!isPickup) {
      if (!shippingAddress.trim()) {
        showToast('La dirección de entrega es obligatoria para este método de envío.', 'error');
        return;
      }
      if (!shippingCity.trim()) {
        showToast('La ciudad es obligatoria para este método de envío.', 'error');
        return;
      }
    }

    if (selectedMethodObj?.name === 'Crédito') {
      if (!customerCredit) {
        showToast('Consultando información de crédito...', 'info');
        return;
      }
      if (!customerCredit.isAvailable) {
        showToast('El sistema de crédito no está disponible en este momento (fuera de temporada u horario activo).', 'error');
        return;
      }
      if (customerCredit.creditStatus === 'suspended' || customerCredit.creditStatus === 'cancelled') {
        showToast('Tu cuenta de crédito se encuentra suspendida o anulada. Por favor contacta al soporte.', 'error');
        return;
      }
      if (customerCredit.creditMode === 'free' && customerCredit.availableBalance < finalTotal) {
        showToast(`Límite de crédito insuficiente. Disponible: $${customerCredit.availableBalance.toFixed(2)}, Requerido: $${finalTotal.toFixed(2)}`, 'error');
        return;
      }
    } else if (requiresProof) {
      if (!paymentRef.trim()) {
        showToast('El número de referencia es requerido para este método de pago.', 'error');
        return;
      }
      if (!receiptFile) {
        showToast('Debes subir un comprobante de pago para este método de pago.', 'error');
        return;
      }
    }

    setLoading(true);

    try {
      const fd = new FormData();
      fd.append('cart', JSON.stringify(cart));
      fd.append('payment_method', paymentMethod);
      fd.append('payment_ref', paymentRef);
      fd.append('customer_message', customerMessage);
      fd.append('shipping_address', shippingAddress);
      fd.append('shipping_city', shippingCity);
      fd.append('shipping_method', selectedShippingMethod);
      if (appliedCoupon) {
        fd.append('coupon_code', appliedCoupon.code);
        fd.append('coupon_id', String(appliedCoupon.id));
        fd.append('discount_amount', String(discountAmount));
      }
      if (receiptFile) fd.append('payment_proof', receiptFile);

      const res = await fetch('/api/checkout', { method: 'POST', body: fd });
      const data = (await res.json()) as any;

      if (!res.ok) {
        if (res.status === 401) {
          showToast('Debes iniciar sesión para completar tu compra.', 'error');
          router.push(`/login?redirect=/checkout`);
        } else {
          showToast(data.error || 'Error al procesar el pedido.', 'error');
        }
      } else {
        clearCart();
        router.push(`/order-confirm?order=${data.orderNumber}`);
      }
    } catch {
      showToast('Error de red. Inténtalo de nuevo.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthChecked) return (
    <section className="section">
      <div className="section-inner" style={{ textAlign: 'center', paddingTop: '6rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔒</div>
        <p style={{ color: 'var(--text-muted)' }}>Verificando sesión...</p>
      </div>
    </section>
  );

  if (cart.length === 0) return null;

  return (
    <section className="section">
      <div className="section-inner">
        <div style={{ textAlign: 'center', marginBottom: '2rem', paddingTop: '4rem' }}>
          <span className="section-tag">Finalizar Compra</span>
          <h1>💳 Checkout</h1>
          <p>Completa tu pedido en unos pasos sencillos</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="cart-layout">
            {/* LEFT COLUMN - Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Shipping Info */}
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1.2rem' }}>📦 Datos de Entrega</h3>
                
                {/* Shipping Method Selection */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.8rem', color: 'var(--gold)' }}>📍 Método de Envío</label>
                  {shippingMethodsLoading ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Cargando métodos de envío...</p>
                  ) : shippingMethods.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No hay métodos de envío activos. Por favor contacta al soporte.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                      {shippingMethods.map(sm => {
                        const isSelected = String(selectedShippingMethod) === String(sm.id);
                        return (
                          <label
                            key={sm.id}
                            htmlFor={`shipping-${sm.id}`}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.9rem',
                              background: isSelected ? 'rgba(212,175,55,0.1)' : 'var(--bg3)',
                              border: `1px solid ${isSelected ? 'var(--gold)' : 'var(--border)'}`,
                              borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s ease'
                            }}
                          >
                            <input
                              type="radio" id={`shipping-${sm.id}`} name="shipping_method"
                              value={sm.id} checked={isSelected}
                              onChange={() => setSelectedShippingMethod(String(sm.id))}
                              style={{ accentColor: 'var(--gold)', width: '18px', height: '18px' }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong style={{ fontSize: '0.88rem' }}>{sm.name}</strong>
                                <span style={{ fontSize: '0.82rem', color: sm.cost > 0 ? 'var(--gold)' : '#2ecc71', fontWeight: 700 }}>
                                  {sm.cost > 0 ? `$${sm.cost.toFixed(2)}` : 'Gratis'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                <span>{sm.description}</span>
                                <span style={{ fontStyle: 'italic' }}>⏱️ {sm.estimated_time}</span>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Dirección de entrega {selectedShippingObj?.name.toLowerCase().includes('retiro') ? '(Opcional)' : '*'}</label>
                  <input 
                    type="text" value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} 
                    placeholder={selectedShippingObj?.name.toLowerCase().includes('retiro') ? "No necesario si retiras en tienda" : "Calle, Urb., Edificio..."} 
                    required={!selectedShippingObj?.name.toLowerCase().includes('retiro')} 
                  />
                </div>
                <div className="form-group">
                  <label>Ciudad / Municipio {selectedShippingObj?.name.toLowerCase().includes('retiro') ? '(Opcional)' : '*'}</label>
                  <input 
                    type="text" value={shippingCity} onChange={e => setShippingCity(e.target.value)} 
                    placeholder={selectedShippingObj?.name.toLowerCase().includes('retiro') ? "No necesario si retiras en tienda" : "Caracas, Valencia..."} 
                    required={!selectedShippingObj?.name.toLowerCase().includes('retiro')} 
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '0.4rem' }}>Mensaje breve o nota del pedido (Opcional)</label>
                  {settings['contact_phone'] && (
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.6rem', lineHeight: '1.4' }}>
                      💡 Puedes dejar un mensaje breve aquí, o te recomendamos 
                      <a 
                        href={`https://wa.me/${settings['contact_phone'].replace(/[^0-9]/g, '')}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ color: 'var(--gold)', fontWeight: 600, marginLeft: '4px', textDecoration: 'underline' }}
                      >
                        escribirnos por WhatsApp
                      </a> para planificar y coordinar todos los detalles de tu compra al instante.
                    </p>
                  )}
                  <textarea value={customerMessage} onChange={e => setCustomerMessage(e.target.value)} rows={2} placeholder="Ej: Por favor entregar por la tarde, o contactarme antes..." style={{ resize: 'vertical' }} />
                </div>
              </div>

              {/* Payment Method */}
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1.2rem' }}>💰 Método de Pago</h3>
                
                {paymentMethodsLoading ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Cargando métodos de pago...</p>
                ) : paymentMethods.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No hay métodos de pago activos. Por favor contacta al administrador.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1.5rem' }}>
                    {paymentMethods.map(m => {
                      const isSelected = String(paymentMethod) === String(m.id);
                      let categoryIcon = '📦';
                      if (m.category === 'mobile_payment') categoryIcon = '📱';
                      else if (m.category === 'bank') categoryIcon = '🏦';
                      else if (m.category === 'wallet') categoryIcon = '💳';
                      else if (m.category === 'cash') categoryIcon = '💵';

                      let formattedDesc = '';
                      const isCreditOption = m.name === 'Crédito';
                      
                      if (isCreditOption) {
                        categoryIcon = '💳';
                        if (customerCredit) {
                          if (!customerCredit.isAvailable) {
                            formattedDesc = '⚠️ No disponible temporalmente (fuera de temporada u horario activo).';
                          } else if (customerCredit.creditStatus !== 'active') {
                            formattedDesc = `⚠️ Línea de crédito inactiva (Estado: ${customerCredit.creditStatus === 'suspended' ? 'Suspendida' : 'Anulada'}).`;
                          } else {
                            formattedDesc = `Saldo Disp: $${customerCredit.availableBalance.toFixed(2)} | Límite: $${customerCredit.creditLimit.toFixed(2)} | Puntos: ${customerCredit.loyaltyPoints} pts | Modo: ${customerCredit.creditMode === 'free' ? 'Crédito Libre' : 'Petición (Espera Aprobación)'}`;
                          }
                        } else {
                          formattedDesc = 'Cargando saldo de crédito...';
                        }
                      } else if (m.category === 'mobile_payment' && m.details) {
                        formattedDesc = `Banco: ${m.details.bank_name || ''} | Teléfono: ${m.details.phone || ''} | Cédula: ${m.details.id_document || ''}`;
                      } else if (m.category === 'bank' && m.details) {
                        formattedDesc = `Banco: ${m.details.bank_name || ''} | Cuenta: ${m.details.account_number || ''} | Titular: ${m.details.owner_name || ''} | RIF: ${m.details.id_document || ''}`;
                      } else if (m.category === 'wallet' && m.details) {
                        const parts = [`Billetera: ${m.details.wallet_name || ''}`, `Correo: ${m.details.email || ''}`];
                        if (m.details.pay_id) parts.push(`Pay ID: ${m.details.pay_id}`);
                        if (m.details.wallet_address) parts.push(`Dirección: ${m.details.wallet_address}`);
                        formattedDesc = parts.join(' | ');
                      } else if ((m.category === 'cash' || m.category === 'other') && m.details) {
                        formattedDesc = m.details.instructions || 'Coordinar entrega';
                      }

                      const isDisabled = isCreditOption && customerCredit && (!customerCredit.isAvailable || customerCredit.creditStatus !== 'active');

                      return (
                        <label
                          key={m.id}
                          htmlFor={`method-${m.id}`}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem',
                            background: isSelected ? 'rgba(212,175,55,0.1)' : 'var(--bg3)',
                            border: `1px solid ${isSelected ? 'var(--gold)' : 'var(--border)'}`,
                            borderRadius: '10px', 
                            cursor: isDisabled ? 'not-allowed' : 'pointer', 
                            transition: 'all 0.2s ease',
                            opacity: isDisabled ? 0.5 : 1
                          }}
                        >
                          <input
                            type="radio" id={`method-${m.id}`} name="payment_method"
                            value={m.id} checked={isSelected}
                            disabled={!!isDisabled}
                            onChange={() => setPaymentMethod(String(m.id))}
                            style={{ accentColor: 'var(--gold)', width: '18px', height: '18px', cursor: isDisabled ? 'not-allowed' : 'pointer' }}
                          />
                          <span style={{ fontSize: '1.4rem' }}>{categoryIcon}</span>
                          <div style={{ flex: 1 }}>
                            <strong style={{ display: 'block', fontSize: '0.9rem' }}>{m.name}</strong>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.2rem', lineHeight: '1.3' }}>{formattedDesc}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                {requiresProof && (
                  <>
                    <div className="form-group">
                      <label>Referencia / Número de Confirmación *</label>
                      <input type="text" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="Ej: TXN-123456" required />
                    </div>

                    {/* Receipt Upload */}
                    <div className="form-group">
                      <label>Comprobante de Pago * (máx. 5 MB)</label>
                      <div
                        style={{
                          border: '2px dashed var(--border)', borderRadius: '10px', padding: '1.5rem',
                          textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s ease',
                          background: receiptFile ? 'rgba(212,175,55,0.06)' : 'transparent'
                        }}
                        onClick={() => document.getElementById('receipt-upload')?.click()}
                      >
                        {receiptPreview ? (
                          <img src={receiptPreview} alt="Comprobante" style={{ maxHeight: '160px', borderRadius: '8px', objectFit: 'contain' }} />
                        ) : receiptFile ? (
                          <p style={{ color: 'var(--gold)' }}>📎 {receiptFile.name}</p>
                        ) : (
                          <>
                            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>📤</span>
                            <p style={{ margin: 0 }}>Click para subir comprobante</p>
                            <small style={{ color: 'var(--text-muted)' }}>JPG, PNG, WEBP o PDF</small>
                          </>
                        )}
                        <input
                          id="receipt-upload" type="file" accept="image/*,.pdf"
                          onChange={handleFileChange} style={{ display: 'none' }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Coupon */}
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>🎫 Cupón de Descuento</h3>
                {appliedCoupon ? (
                  <div className="alert alert-success" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }}>
                    <span>✅ <strong>{appliedCoupon.code}</strong> — Descuento: ${discountAmount.toFixed(2)}</span>
                    <button type="button" onClick={() => { setAppliedCoupon(null); setDiscountAmount(0); setCouponCode(''); }} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.8rem' }}>
                    <input
                      type="text" value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="CUPÓN2025" style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem 1rem', color: 'var(--text)', fontSize: '0.9rem', outline: 'none' }}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleApplyCoupon())}
                    />
                    <button type="button" onClick={handleApplyCoupon} className="btn-outline" disabled={couponLoading} style={{ whiteSpace: 'nowrap' }}>
                      {couponLoading ? '...' : 'Aplicar'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN - Order Summary */}
            <div className="cart-summary">
              <h3>Resumen del Pedido</h3>
              <div className="glow-line" style={{ marginBottom: '1rem' }}></div>

              <div style={{ maxHeight: '240px', overflowY: 'auto', marginBottom: '1rem' }}>
                {cart.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.6rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                    <span style={{ flex: 1, paddingRight: '1rem' }}>
                      {item.name}
                      {item.price_type === 'base' && (
                        <span style={{
                          marginLeft: '0.5rem',
                          fontSize: '0.7rem',
                          padding: '0.05rem 0.3rem',
                          borderRadius: '4px',
                          background: 'rgba(235, 94, 40, 0.15)',
                          color: '#eb5e28',
                          border: '1px solid rgba(235, 94, 40, 0.3)',
                          fontWeight: 600,
                          display: 'inline-block'
                        }}>
                          Base
                        </span>
                      )}
                      {item.price_type === 'range' && (
                        <span style={{
                          marginLeft: '0.5rem',
                          fontSize: '0.7rem',
                          padding: '0.05rem 0.3rem',
                          borderRadius: '4px',
                          background: 'rgba(58, 125, 68, 0.15)',
                          color: '#3a7d44',
                          border: '1px solid rgba(58, 125, 68, 0.3)',
                          fontWeight: 600,
                          display: 'inline-block'
                        }}>
                          Variable
                        </span>
                      )}
                      {' '}
                      <span style={{ color: 'var(--text-muted)' }}>×{item.quantity}</span>
                    </span>
                    <span style={{ color: 'var(--gold)', fontWeight: 600 }}>
                      {(item.price_type === 'base' || item.price_type === 'range') && 'Desde '}
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="summary-row">
                <span>Subtotal</span>
                <span>
                  {hasVariablePrice && 'Desde '}
                  ${cartTotal.toFixed(2)}
                </span>
              </div>
              {discountAmount > 0 && (
                <div className="summary-row" style={{ color: 'var(--success)' }}>
                  <span>Descuento (cupón)</span>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="summary-row">
                <span>Envío ({selectedShippingObj ? selectedShippingObj.name : 'Cargando...'})</span>
                <span>{shippingCost > 0 ? `$${shippingCost.toFixed(2)}` : 'Gratis'}</span>
              </div>

              <div className="summary-total" style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 700, color: 'var(--gold)' }}>
                <span>TOTAL</span>
                <span>
                  {hasVariablePrice && 'Desde '}
                  ${finalTotal.toFixed(2)}
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

              {/* Warnings and messages */}
              {!isStoreOpen(settings) && (
                <div style={{
                  marginTop: '1.2rem',
                  padding: '0.8rem',
                  borderRadius: '8px',
                  background: 'rgba(231, 76, 60, 0.1)',
                  border: '1px solid #e74c3c',
                  color: '#e74c3c',
                  fontSize: '0.82rem',
                  lineHeight: 1.4,
                  textAlign: 'center'
                }}>
                  ⚠️ <strong>Tienda Cerrada:</strong> En este momento la tienda se encuentra cerrada (por mantenimiento o fuera del horario comercial). Por favor intenta más tarde.
                </div>
              )}

              {isStoreOpen(settings) && Number(settings['min_order'] || 0) > 0 && cartTotal < Number(settings['min_order']) && (
                <div style={{
                  marginTop: '1.2rem',
                  padding: '0.8rem',
                  borderRadius: '8px',
                  background: 'rgba(212, 175, 55, 0.1)',
                  border: '1px solid var(--gold)',
                  color: 'var(--gold)',
                  fontSize: '0.82rem',
                  lineHeight: 1.4,
                  textAlign: 'center'
                }}>
                  ⚠️ <strong>Pedido Mínimo Requerido:</strong> El monto mínimo para realizar un pedido es de <strong>${Number(settings['min_order']).toFixed(2)}</strong>. Tu subtotal actual es de <strong>${cartTotal.toFixed(2)}</strong>. Por favor agrega más productos al carrito.
                </div>
              )}

              <button 
                type="submit" 
                className="btn-primary" 
                disabled={loading || !isStoreOpen(settings) || cartTotal < Number(settings['min_order'] || 0)} 
                style={{ width: '100%', justifyContent: 'center', marginTop: '1.5rem', fontSize: '1rem', padding: '1rem' }}
              >
                {loading ? '⏳ Procesando...' : '✅ Confirmar Pedido'}
              </button>
              <p style={{ textAlign: 'center', marginTop: '0.8rem', fontSize: '0.75rem' }}>
                🔒 Tus datos están protegidos y seguros
              </p>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
