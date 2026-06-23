'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ConfirmContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('order') || '';

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto', textAlign: 'center', padding: '0 1rem' }}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
        padding: '3rem 2rem', marginTop: '2rem'
      }}>
        {/* Success animation */}
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          background: 'rgba(46,204,113,0.15)', border: '2px solid rgba(46,204,113,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.5rem', fontSize: '2.5rem'
        }}>
          ✅
        </div>

        <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>¡Pedido Recibido!</h1>
        <p style={{ marginBottom: '1.5rem' }}>
          Hemos recibido tu solicitud y está siendo procesada. Recibirás una confirmación por email.
        </p>

        {orderNumber && (
          <div style={{
            background: 'rgba(212,175,55,0.08)', border: '1px solid var(--border)',
            borderRadius: '10px', padding: '1rem 1.5rem', marginBottom: '1.5rem'
          }}>
            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
              NÚMERO DE PEDIDO
            </span>
            <strong style={{ fontSize: '1.4rem', color: 'var(--gold)', letterSpacing: '2px' }}>
              {orderNumber}
            </strong>
          </div>
        )}

        <div style={{
          background: 'var(--bg3)', borderRadius: '10px', padding: '1rem',
          marginBottom: '1.5rem', textAlign: 'left'
        }}>
          <h4 style={{ marginBottom: '0.8rem', fontSize: '0.9rem' }}>📋 Próximos pasos:</h4>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>📧 Revisa tu email para el resumen del pedido</li>
            <li style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>📱 Te contactaremos por WhatsApp para coordinar entrega</li>
            <li style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>🕐 Procesamiento en 24-48 horas hábiles</li>
          </ul>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <Link href="/my-orders" className="btn-primary" style={{ justifyContent: 'center' }}>
            📦 Ver Mis Pedidos
          </Link>
          <Link href="/" className="btn-outline" style={{ justifyContent: 'center' }}>
            🏪 Seguir Comprando
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OrderConfirmPage() {
  return (
    <section className="section" style={{ paddingTop: '5rem' }}>
      <div className="section-inner">
        <Suspense fallback={<div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>Cargando...</div>}>
          <ConfirmContent />
        </Suspense>
      </div>
    </section>
  );
}
