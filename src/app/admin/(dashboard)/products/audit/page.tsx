'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/context/ToastContext';
import Link from 'next/link';
import CameraScanner from '@/components/CameraScanner';

interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
  type: string;
  barcode: string | null;
}

interface AuditedProduct extends Product {
  countedQty: number;
}

export default function InventoryAuditPage() {
  const { showToast } = useToast();
  const router = useRouter();

  const [scanInput, setScanInput] = useState('');
  const [auditedItems, setAuditedItems] = useState<AuditedProduct[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const scanInputRef = useRef<HTMLInputElement>(null);

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
        osc.frequency.setValueAtTime(900, ctx.currentTime);
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
      console.warn('Audio feedback failed:', err);
    }
  };

  // Load active catalog products
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await fetch('/api/products?activeOnly=true&limit=1000');
        const data = (await res.json()) as any;
        if (data.success) {
          setCatalogProducts(data.products || []);
        } else {
          showToast('Error al cargar catálogo de productos.', 'error');
        }
      } catch (err) {
        console.error(err);
        showToast('Error de red al cargar productos.', 'error');
      } finally {
        setLoadingCatalog(false);
      }
    };
    loadProducts();
  }, [showToast]);

  // Keep focus on scan input
  useEffect(() => {
    if (scanInputRef.current) {
      scanInputRef.current.focus();
    }
    const refocus = () => {
      if (scanInputRef.current && document.activeElement !== scanInputRef.current) {
        scanInputRef.current.focus();
      }
    };
    document.addEventListener('click', refocus);
    return () => document.removeEventListener('click', refocus);
  }, []);

  const lookupBarcode = (code: string) => {
    if (!code) return;

    // Look for product in catalog by barcode or name match (case insensitive)
    const product = catalogProducts.find(
      (p) =>
        p.barcode === code ||
        p.name.toLowerCase() === code.toLowerCase() ||
        String(p.id) === code
    );

    if (product) {
      if (product.type === 'service') {
        showToast(`El item "${product.name}" es un servicio. No se audita stock para servicios.`, 'error');
        playBeep('error');
        return;
      }

      setAuditedItems((prev) => {
        const existingIdx = prev.findIndex((item) => item.id === product.id);
        if (existingIdx > -1) {
          const updated = [...prev];
          updated[existingIdx].countedQty += 1;
          showToast(`Contador incrementado para: ${product.name} (${updated[existingIdx].countedQty})`, 'success');
          return updated;
        } else {
          showToast(`Producto agregado a la lista: ${product.name}`, 'success');
          return [...prev, { ...product, countedQty: 1 }];
        }
      });
      playBeep('success');
    } else {
      showToast(`Código o producto "${code}" no encontrado en el catálogo.`, 'error');
      playBeep('error');
    }
  };

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    lookupBarcode(scanInput.trim());
    setScanInput('');
  };

  const handleQtyChange = (productId: number, val: string) => {
    const qty = parseInt(val, 10);
    if (!isNaN(qty) && qty >= 0) {
      setAuditedItems((prev) =>
        prev.map((item) => (item.id === productId ? { ...item, countedQty: qty } : item))
      );
    }
  };

  const handleIncrement = (productId: number, amount: number) => {
    setAuditedItems((prev) =>
      prev.map((item) => {
        if (item.id === productId) {
          const newQty = Math.max(0, item.countedQty + amount);
          return { ...item, countedQty: newQty };
        }
        return item;
      })
    );
  };

  const handleRemoveItem = (productId: number) => {
    setAuditedItems((prev) => prev.filter((item) => item.id !== productId));
    showToast('Producto removido de la lista de auditoría.', 'info');
  };

  const handleSaveAudit = async () => {
    if (auditedItems.length === 0) {
      showToast('Agregue al menos un producto a la lista antes de guardar.', 'error');
      return;
    }

    if (!confirm('¿Estás seguro de aplicar los conteos físicos? Esto actualizará de forma definitiva el inventario actual de los productos discrepantes.')) {
      return;
    }

    setSubmitting(true);
    try {
      const itemsPayload = auditedItems.map((item) => ({
        id: item.id,
        currentStock: item.stock,
        countedStock: item.countedQty,
      }));

      const res = await fetch('/api/admin/products/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsPayload }),
      });

      const data = (await res.json()) as any;
      if (res.ok && data.success) {
        showToast('✅ Auditoría física aplicada e inventario actualizado correctamente.', 'success');
        playBeep('success');
        setAuditedItems([]);
        router.refresh();
        
        // Reload product catalog to get latest stocks
        setLoadingCatalog(true);
        const refetch = await fetch('/api/products?activeOnly=true&limit=1000');
        const refetchData = (await refetch.json()) as any;
        if (refetchData.success) {
          setCatalogProducts(refetchData.products || []);
        }
        setLoadingCatalog(false);
      } else {
        showToast(data.error || 'Error al guardar la auditoría.', 'error');
        playBeep('error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al aplicar la auditoría.', 'error');
      playBeep('error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '1.5rem', color: 'var(--text)', background: 'var(--bg-main)', minHeight: '100vh' }}>
      {/* Topbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--primary, var(--gold))', margin: 0 }}>🔍 Toma Física de Inventario</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.2rem 0 0 0' }}>Realiza auditorías de almacén escaneando códigos de barra. Las diferencias de inventario se ajustarán automáticamente.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.8rem' }}>
          <Link href="/admin/products" className="btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.82rem', textDecoration: 'none' }}>
            🛍️ Ver Productos
          </Link>
          <button
            onClick={() => setAuditedItems([])}
            disabled={auditedItems.length === 0}
            className="btn-outline"
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.82rem',
              color: 'var(--error)',
              borderColor: 'rgba(231, 76, 60, 0.3)',
              cursor: auditedItems.length === 0 ? 'not-allowed' : 'pointer',
              opacity: auditedItems.length === 0 ? 0.5 : 1
            }}
          >
            🗑️ Limpiar Lista
          </button>
        </div>
      </div>

      {/* Scan section */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.8rem 0', fontSize: '1rem', color: 'var(--gold)' }}>📋 Escanee un producto para comenzar</h3>
        <form onSubmit={handleScanSubmit} style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          <input
            ref={scanInputRef}
            type="text"
            placeholder="Escanee con el lector de códigos o busque por ID/Nombre..."
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            disabled={loadingCatalog || submitting}
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text)',
              fontSize: '0.92rem',
              outline: 'none',
              fontFamily: 'monospace',
              letterSpacing: '0.05em'
            }}
          />
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            style={{
              background: 'rgba(212,175,55,0.15)',
              border: '1.5px solid var(--gold)',
              color: 'var(--gold)',
              borderRadius: '8px',
              height: '44px',
              width: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              flexShrink: 0
            }}
            title="Escanear con cámara"
          >
            📷
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={loadingCatalog || submitting}
            style={{ padding: '0 1.5rem', fontWeight: 700, fontSize: '0.88rem', height: '44px' }}
          >
            Añadir
          </button>
        </form>
        <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.4rem', display: 'block' }}>
          * El campo superior mantiene el enfoque automático. Simplemente apunte y dispare el lector láser sobre los códigos de barra.
        </small>
      </div>

      {/* Main Grid / Audit List */}
      {loadingCatalog ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          Cargando catálogo de productos para validación...
        </div>
      ) : auditedItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '5rem', background: 'var(--bg2)', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>📊</span>
          <p style={{ margin: 0, fontSize: '0.95rem' }}>Ningún producto escaneado todavía.</p>
          <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Escanee su primer producto o busque por nombre para iniciar el conteo.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="table-responsive" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '1rem' }}>Código / ID</th>
                  <th style={{ padding: '1rem' }}>Nombre del Producto</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }}>Stock Sistema</th>
                  <th style={{ padding: '1rem', textAlign: 'center', width: '220px' }}>Stock Contado Físico</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }}>Diferencia</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {auditedItems.map((item) => {
                  const diff = item.countedQty - item.stock;
                  let diffColor = 'var(--text-muted)';
                  let diffLabel = '0';
                  if (diff > 0) {
                    diffColor = '#2ecc71';
                    diffLabel = `+${diff}`;
                  } else if (diff < 0) {
                    diffColor = '#e74c3c';
                    diffLabel = `${diff}`;
                  }

                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '1rem', fontFamily: 'monospace', fontSize: '0.82rem' }}>
                        {item.barcode || `ID: ${item.id}`}
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{item.name}</td>
                      <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold' }}>{item.stock}</td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleIncrement(item.id, -1)}
                            style={{
                              background: 'var(--bg3)',
                              border: '1px solid var(--border)',
                              color: 'var(--text)',
                              width: '30px',
                              height: '30px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              fontSize: '1rem'
                            }}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={item.countedQty}
                            onChange={(e) => handleQtyChange(item.id, e.target.value)}
                            style={{
                              width: '60px',
                              height: '30px',
                              textAlign: 'center',
                              background: 'var(--bg)',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              color: 'var(--text)',
                              outline: 'none',
                              fontSize: '0.88rem'
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleIncrement(item.id, 1)}
                            style={{
                              background: 'var(--bg3)',
                              border: '1px solid var(--border)',
                              color: 'var(--text)',
                              width: '30px',
                              height: '30px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              fontSize: '1rem'
                            }}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 700, color: diffColor }}>
                        {diffLabel}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--error)',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                          }}
                        >
                          ✕ Quitar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Submitting Section */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Discrepancias registradas: <strong>{auditedItems.filter((i) => i.countedQty !== i.stock).length}</strong> productos.
            </span>
            <button
              onClick={handleSaveAudit}
              disabled={submitting}
              className="btn-primary"
              style={{
                padding: '0.75rem 1.8rem',
                fontWeight: 700,
                fontSize: '0.9rem',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {submitting ? '⏳ Procesando Ajustes...' : '💾 Aplicar Toma de Stock'}
            </button>
          </div>
        </div>
      )}
      {isScannerOpen && (
        <CameraScanner
          onScan={(code) => {
            lookupBarcode(code);
            setIsScannerOpen(false);
          }}
          onClose={() => setIsScannerOpen(false)}
        />
      )}
    </div>
  );
}
