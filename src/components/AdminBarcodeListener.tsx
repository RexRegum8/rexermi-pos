'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/context/ToastContext';
import Image from 'next/image';

interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
  type: string;
  slug: string;
  image: string | null;
  barcode: string | null;
  min_stock_alert?: number | null;
}

export default function AdminBarcodeListener() {
  const { showToast } = useToast();
  const router = useRouter();
  
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [adjustStockVal, setAdjustStockVal] = useState('');

  // Audio feedback helper
  const playBeep = (type: 'success' | 'error') => {
    if (typeof window === 'undefined') return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(950, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.08);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (err) {
      console.warn('Audio feedback blocked or failed:', err);
    }
  };

  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ignore key events when user is focusing on input fields
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.hasAttribute('contenteditable')
      ) {
        return;
      }

      const currentTime = Date.now();
      // Hardware scanner is very fast, usually keys are sent < 40ms apart
      if (currentTime - lastKeyTime > 60) {
        buffer = '';
      }
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        const code = buffer.trim();
        if (code.length >= 3) {
          e.preventDefault();
          buffer = '';
          await handleScan(code);
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleScan = async (code: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/vendedor/products?barcode=${encodeURIComponent(code)}`);
      if (res.ok) {
        const prod = (await res.json()) as any;
        if (prod && prod.id) {
          setProduct(prod);
          setAdjustStockVal(String(prod.stock));
          setModalOpen(true);
          playBeep('success');
          showToast(`🔍 Producto escaneado: ${prod.name}`, 'success');
        } else {
          showToast('Código de barras no asignado a ningún producto activo', 'error');
          playBeep('error');
        }
      } else {
        showToast('Código de barras no encontrado en el sistema', 'error');
        playBeep('error');
      }
    } catch (err) {
      console.error('Error fetching barcode product:', err);
      showToast('Error de red al consultar el producto', 'error');
      playBeep('error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    const newStock = parseInt(adjustStockVal, 10);
    if (isNaN(newStock) || newStock < 0) {
      showToast('Ingresa un stock válido mayor o igual a 0', 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/products/${product.id}/adjust-stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: newStock }),
      });
      const data = (await res.json()) as any;
      if (res.ok && data.success) {
        showToast(`✅ Stock actualizado para: ${product.name} (Anterior: ${data.oldStock} → Nuevo: ${data.newStock})`, 'success');
        setProduct(prev => prev ? { ...prev, stock: newStock } : null);
        playBeep('success');
        router.refresh();
      } else {
        showToast(data.error || 'Error al actualizar el stock.', 'error');
        playBeep('error');
      }
    } catch (err) {
      console.error('Error saving stock adjustment:', err);
      showToast('Error de red al actualizar stock', 'error');
      playBeep('error');
    } finally {
      setSaving(false);
    }
  };

  if (!modalOpen || !product) return null;

  const minAlert = product.min_stock_alert !== undefined && product.min_stock_alert !== null ? product.min_stock_alert : 3;
  const isLowStock = product.type === 'product' && product.stock <= minAlert;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(12px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={() => setModalOpen(false)}
    >
      <div
        style={{
          background: 'rgba(30, 41, 59, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '480px',
          padding: '1.8rem',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
          color: '#fff',
          animation: 'fadeInUp 0.25s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '0.8rem', marginBottom: '1.2rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            📊 Escaneo de Producto (Vista Rápida)
          </h3>
          <button
            onClick={() => setModalOpen(false)}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '1.3rem', cursor: 'pointer', outline: 'none' }}
          >
            ✕
          </button>
        </div>

        {/* Product Info Card */}
        <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'center', marginBottom: '1.5rem', background: 'rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
          {product.image ? (
            <div style={{ position: 'relative', width: '76px', height: '76px', borderRadius: '8px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', flexShrink: 0 }}>
              <Image src={`/api/assets/uploads/${product.image}`} alt={product.name} fill sizes="76px" style={{ objectFit: 'cover' }} />
            </div>
          ) : (
            <div style={{ width: '76px', height: '76px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', flexShrink: 0 }}>
              📦
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={product.name}>
              {product.name}
            </h4>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginTop: '0.3rem' }}>
              <span style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.1)', color: 'rgba(255,255,255,0.7)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>
                {product.barcode}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                ID: {product.id}
              </span>
            </div>
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.8rem', alignItems: 'baseline' }}>
              <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '1.1rem' }}>${Number(product.price).toFixed(2)}</span>
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>Precio de venta</span>
            </div>
          </div>
        </div>

        {/* Stock Status Badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', padding: '0.8rem 1rem', borderRadius: '8px', background: isLowStock ? 'rgba(231, 76, 60, 0.15)' : 'rgba(39, 174, 96, 0.15)', border: isLowStock ? '1px solid rgba(231, 76, 60, 0.25)' : '1px solid rgba(39, 174, 96, 0.25)' }}>
          <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' }}>Existencia actual:</span>
          <strong style={{ fontSize: '1.15rem', color: isLowStock ? '#e74c3c' : '#2ecc71', fontWeight: 700 }}>
            {product.type === 'service' ? 'Ilimitado (∞)' : `${product.stock} unidades`}
          </strong>
        </div>

        {/* Quick Stock Adjustment Form */}
        {product.type === 'product' && (
          <form onSubmit={handleSaveStock} style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1.2rem', marginBottom: '1.5rem' }}>
            <label style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', display: 'block', marginBottom: '0.5rem' }}>
              ✏️ Ajustar stock físico directamente:
            </label>
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <input
                type="number"
                min="0"
                value={adjustStockVal}
                onChange={(e) => setAdjustStockVal(e.target.value)}
                style={{
                  flex: 1,
                  padding: '0.6rem 0.8rem',
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '8px',
                  color: '#fff',
                  outline: 'none',
                  fontSize: '0.9rem',
                }}
                disabled={saving}
              />
              <button
                type="submit"
                style={{
                  background: 'var(--gold)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#000',
                  padding: '0 1.2rem',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                  transition: 'background-color 0.2s',
                }}
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        )}

        {/* Modal Actions */}
        <div style={{ display: 'flex', gap: '0.8rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1.2rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '8px',
              color: 'rgba(255,255,255,0.8)',
              padding: '0.5rem 1rem',
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => {
              setModalOpen(false);
              router.push(`/admin/products/${product.id}/edit`);
            }}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              color: '#fff',
              padding: '0.5rem 1rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ✏️ Ficha Completa
          </button>
        </div>
      </div>
    </div>
  );
}
