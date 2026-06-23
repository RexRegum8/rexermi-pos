'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import AdminOrderActions from './AdminOrderActions';
import { useToast } from '@/context/ToastContext';

interface Order {
  id: number; order_number: string; status: string; total: number;
  payment_method: string; payment_proof: string | null;
  created_at: string; user_name: string; user_email: string; item_count: number;
  items_json?: string;
  shipping_address?: string | null;
  shipping_city?: string | null;
  customer_message?: string | null;
  admin_notes?: string | null;
  shipping_method?: string | null;
  shipping_cost?: number | null;
}

const STATUS_CLASS: Record<string, string> = {
  pending: 'status-pending', paid: 'status-paid', processing: 'status-processing',
  shipped: 'status-shipped', delivered: 'status-delivered', cancelled: 'status-cancelled',
};

const BULK_STATUSES = [
  { value: 'paid',       label: '✅ Pagado' },
  { value: 'processing', label: '⚙️ Procesando' },
  { value: 'shipped',    label: '🚚 Enviado' },
  { value: 'delivered',  label: '📦 Entregado' },
  { value: 'cancelled',  label: '❌ Cancelado' },
];

const getReceiptUrl = (proof: string) => {
  if (!proof) return '';
  if (proof.startsWith('http')) return proof;
  const filename = proof.includes('/') ? proof.split('/').pop() : proof;
  return `/api/receipts/${filename}`;
};

export default function OrdersTable({
  initialOrders, totalPages, currentPage, totalItems,
}: {
  initialOrders: Order[];
  totalPages: number;
  currentPage: number;
  totalItems: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { showToast } = useToast();

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') || '');
  const [showCompleted, setShowCompleted] = useState(searchParams.get('showCompleted') === 'true');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '');

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const [editingNotes, setEditingNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    if (selectedOrder) {
      setEditingNotes(selectedOrder.admin_notes || '');
    }
  }, [selectedOrder]);

  const handleSaveNotes = async () => {
    if (!selectedOrder) return;
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_notes: editingNotes }),
      });
      const data = await res.json() as any;
      if (res.ok && data.success) {
        showToast('✅ Nota de admin guardada.', 'success');
        selectedOrder.admin_notes = editingNotes;
        router.refresh();
      } else {
        showToast(data.error || 'Error al guardar notas.', 'error');
      }
    } catch {
      showToast('Error de red al guardar notas.', 'error');
    } finally {
      setSavingNotes(false);
    }
  };

  const currentSortBy = searchParams.get('sortBy') || 'date';
  const currentSortOrder = searchParams.get('sortOrder') || 'desc';

  const handleSort = (field: string) => {
    let nextOrder = 'desc';
    if (currentSortBy === field) {
      nextOrder = currentSortOrder === 'desc' ? 'asc' : 'desc';
    } else {
      nextOrder = (field === 'order' || field === 'status') ? 'asc' : 'desc';
    }
    updateURL({ sortBy: field, sortOrder: nextOrder, page: '1' });
  };

  const renderSortIndicator = (field: string) => {
    if (currentSortBy !== field) return <span style={{ opacity: 0.35, marginLeft: '0.2rem', fontSize: '0.75rem' }}>↕</span>;
    return currentSortOrder === 'asc' 
      ? <span style={{ color: 'var(--gold)', marginLeft: '0.2rem', fontSize: '0.75rem' }}>▲</span>
      : <span style={{ color: 'var(--gold)', marginLeft: '0.2rem', fontSize: '0.75rem' }}>▼</span>;
  };

  const updateURL = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, val]) => {
      if (val === null || val === '') params.delete(key);
      else params.set(key, val);
    });
    router.push(`${pathname}?${params.toString()}`);
  }, [searchParams, pathname, router]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      const current = searchParams.get('search') || '';
      if (searchQuery.trim() !== current.trim()) updateURL({ search: searchQuery.trim(), page: '1' });
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Date filter debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      const cfrom = searchParams.get('dateFrom') || '';
      const cto   = searchParams.get('dateTo')   || '';
      if (dateFrom !== cfrom || dateTo !== cto) {
        updateURL({ dateFrom: dateFrom || null, dateTo: dateTo || null, page: '1' });
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [dateFrom, dateTo]);

  // Clear selections when orders change
  useEffect(() => { setSelectedIds(new Set()); }, [initialOrders]);

  const handlePrintTicket = (order: Order) => {
    let items: any[] = [];
    try {
      items = order.items_json ? JSON.parse(order.items_json) : [];
    } catch (e) {
      console.error(e);
    }

    const printWindow = window.open('', '_blank', 'width=600,height=600');
    if (!printWindow) {
      showToast('No se pudo abrir la ventana de impresión. Verifique los bloqueadores de popups.', 'error');
      return;
    }

    const itemsHtml = items.map(item => `
      <tr>
        <td style="padding: 4px 0; font-family: monospace; font-size: 11px;">
          ${item.quantity}x ${item.name.substring(0, 24)}
        </td>
        <td style="text-align: right; padding: 4px 0; font-family: monospace; font-size: 11px;">
          $${Number(item.price).toFixed(2)}
        </td>
        <td style="text-align: right; padding: 4px 0; font-family: monospace; font-size: 11px;">
          $${Number(item.price * item.quantity).toFixed(2)}
        </td>
      </tr>
    `).join('');

    const htmlContent = `
      <html>
        <head>
          <title>Ticket ${order.order_number}</title>
          <style>
            @page {
              margin: 0;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 12px;
              line-height: 1.3;
              width: 72mm;
              margin: 0 auto;
              padding: 10px;
              color: #000;
              background: #fff;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .bold { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; }
            th { border-bottom: 1px solid #000; padding: 4px 0; font-size: 11px; text-align: left; }
            .footer { margin-top: 20px; font-size: 10px; }
          </style>
        </head>
        <body>
          <div class="text-center">
            <h2 style="margin: 0; font-size: 15px;">REXERMI</h2>
            <p style="margin: 2px 0; font-size: 10px;">Marketplace & Delivery</p>
            <p style="margin: 2px 0; font-size: 9px;">RIF: J-50478123-4</p>
          </div>
          <div class="divider"></div>
          <div>
            <p style="margin: 3px 0;"><strong>TICKET:</strong> ${order.order_number}</p>
            <p style="margin: 3px 0;"><strong>FECHA:</strong> ${new Date(order.created_at).toLocaleString('es-VE')}</p>
            <p style="margin: 3px 0;"><strong>CLIENTE:</strong> ${order.user_name}</p>
            ${order.shipping_address ? `<p style="margin: 3px 0;"><strong>DIR:</strong> ${order.shipping_address}</p>` : ''}
            <p style="margin: 3px 0;"><strong>PAGO:</strong> ${order.payment_method}</p>
          </div>
          <div class="divider"></div>
          <table>
            <thead>
              <tr>
                <th style="font-family: monospace;">CANT / PROD</th>
                <th style="text-align: right; font-family: monospace;">PRECIO</th>
                <th style="text-align: right; font-family: monospace;">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div class="divider"></div>
          <table style="font-size: 11px;">
            <tr>
              <td class="bold">Subtotal:</td>
              <td class="text-right">$${Number(order.total - (order.shipping_cost || 0)).toFixed(2)}</td>
            </tr>
            ${Number(order.shipping_cost || 0) > 0 ? `
            <tr>
              <td class="bold">Envío:</td>
              <td class="text-right">$${Number(order.shipping_cost).toFixed(2)}</td>
            </tr>
            ` : ''}
            <tr style="font-size: 13px;">
              <td class="bold">TOTAL USD:</td>
              <td class="text-right bold">$${Number(order.total).toFixed(2)}</td>
            </tr>
          </table>
          <div class="divider"></div>
          <div class="text-center footer">
            <p class="bold">¡GRACIAS POR SU COMPRA!</p>
            <p>Visite de nuevo rexermimarketplace.com</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const allChecked = initialOrders.length > 0 && initialOrders.every(o => selectedIds.has(o.id));
  const someChecked = selectedIds.size > 0;

  const toggleAll = () => {
    if (allChecked) setSelectedIds(new Set());
    else setSelectedIds(new Set(initialOrders.map(o => o.id)));
  };

  const toggleOne = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkUpdate = async () => {
    if (!bulkStatus || selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch('/api/admin/orders/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: Array.from(selectedIds), status: bulkStatus }),
      });
      const data = await res.json() as any;
      if (data.success) {
        showToast(`✅ ${data.message}`, 'success');
        setSelectedIds(new Set());
        setBulkStatus('');
        router.refresh();
      } else {
        showToast(data.error || 'Error al actualizar pedidos.', 'error');
      }
    } catch {
      showToast('Error de red al actualizar pedidos.', 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleExportCSV = () => {
    setExportLoading(true);
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (selectedStatus) params.set('status', selectedStatus);
    if (showCompleted) params.set('showCompleted', 'true');
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    const url = `/api/admin/orders/export?${params.toString()}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setExportLoading(false), 2000);
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: '10px', padding: '0.7rem 0.9rem',
    color: 'var(--text)', fontSize: '0.88rem', outline: 'none',
    minHeight: '44px', cursor: 'pointer',
  };

  return (
    <>
      {/* ─── Filters Bar ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1.5rem' }}>
        {/* Row 1: Search + Status + Export */}
        <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-bar" style={{ flex: 2, minWidth: '200px', margin: 0 }}>
            <input
              type="text"
              placeholder="🔍 Buscar pedido por número, cliente, correo..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <select value={selectedStatus} onChange={e => { setSelectedStatus(e.target.value); updateURL({ status: e.target.value, page: '1' }); }} style={{ ...inputStyle, flex: 1, minWidth: '150px' }}>
            <option value="">Todos los Estados</option>
            <option value="pending">⏳ Pendiente</option>
            <option value="paid">✅ Pagado</option>
            <option value="processing">⚙️ Procesando</option>
            <option value="shipped">🚚 Enviado</option>
            <option value="delivered">📦 Entregado</option>
            <option value="cancelled">❌ Cancelado</option>
          </select>
          <button
            onClick={handleExportCSV}
            disabled={exportLoading}
            style={{ ...inputStyle, background: 'rgba(212,175,55,0.1)', color: 'var(--gold)', border: '1px solid rgba(212,175,55,0.4)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            {exportLoading ? '⏳' : '⬇️'} CSV
          </button>
        </div>
        {/* Row 2: Date range + show completed */}
        <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>📅 Desde:</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inputStyle, flex: '0 0 auto' }} />
          <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Hasta:</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...inputStyle, flex: '0 0 auto' }} />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} style={{ fontSize: '0.8rem', background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>✕ Limpiar fechas</button>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem', color: 'var(--text)', marginLeft: 'auto' }}>
            <input type="checkbox" checked={showCompleted} onChange={e => { setShowCompleted(e.target.checked); updateURL({ showCompleted: e.target.checked ? 'true' : null, page: '1' }); }} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--gold)' }} />
            Mostrar completados
          </label>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{totalItems} pedidos</span>
        </div>
      </div>

      {/* ─── Bulk Action Bar ─── */}
      {someChecked && (
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', padding: '0.8rem 1rem', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '10px', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--gold)' }}>
            {selectedIds.size} pedido{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} style={{ ...inputStyle, minWidth: '160px' }}>
            <option value="">Cambiar estado a...</option>
            {BULK_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button onClick={handleBulkUpdate} disabled={!bulkStatus || bulkLoading} className="btn-primary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', opacity: (!bulkStatus || bulkLoading) ? 0.5 : 1 }}>
            {bulkLoading ? 'Actualizando...' : '✓ Aplicar'}
          </button>
          <button onClick={() => setSelectedIds(new Set())} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.82rem' }}>✕ Limpiar selección</button>
        </div>
      )}

      {/* ─── Desktop Table ─── */}
      <div className="desktop-only table-card">
        <table>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>
                <input type="checkbox" checked={allChecked} onChange={toggleAll} style={{ width: '16px', height: '16px', accentColor: 'var(--gold)', cursor: 'pointer' }} title="Seleccionar todos" />
              </th>
              <th onClick={() => handleSort('order')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center' }}>Orden {renderSortIndicator('order')}</div>
              </th>
              <th>Cliente</th>
              <th>Items</th>
              <th onClick={() => handleSort('total')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center' }}>Total {renderSortIndicator('total')}</div>
              </th>
              <th>Pago</th>
              <th onClick={() => handleSort('status')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center' }}>Estado {renderSortIndicator('status')}</div>
              </th>
              <th onClick={() => handleSort('date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center' }}>Fecha {renderSortIndicator('date')}</div>
              </th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {initialOrders.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No se encontraron pedidos con los filtros actuales.</td></tr>
            ) : initialOrders.map(o => {
              let items: any[] = [];
              try { items = o.items_json ? JSON.parse(o.items_json) : []; } catch { /* ignore */ }
              const isChecked = selectedIds.has(o.id);
              return (
                <React.Fragment key={o.id}>
                  <tr style={{ background: isChecked ? 'rgba(212,175,55,0.05)' : undefined }}>
                    <td>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleOne(o.id)} style={{ width: '16px', height: '16px', accentColor: 'var(--gold)', cursor: 'pointer' }} />
                    </td>
                    <td>
                      <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '0.85rem' }}>{o.order_number}</span>
                      {o.payment_proof && (
                        <a href={getReceiptUrl(o.payment_proof)} target="_blank" rel="noopener noreferrer" title="Ver comprobante" style={{ marginLeft: '0.4rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>🧾</a>
                      )}
                    </td>
                    <td className="allow-wrap">
                      <strong>{o.user_name}</strong>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{o.user_email}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>{o.item_count}</td>
                    <td style={{ color: 'var(--gold)', fontWeight: 700 }}>${Number(o.total).toFixed(2)}</td>
                    <td style={{ fontSize: '0.82rem' }}>{o.payment_method}</td>
                    <td><span className={`status-badge ${STATUS_CLASS[o.status] || ''}`}>{o.status}</span></td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{new Date(o.created_at).toLocaleDateString('es-VE')}</td>
                    <td><AdminOrderActions orderId={o.id} currentStatus={o.status} /></td>
                  </tr>
                  {items.length > 0 && (
                    <tr>
                      <td colSpan={9} style={{ padding: '0.5rem 1rem', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                        <details style={{ fontSize: '0.85rem' }}>
                          <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 600 }}>Ver productos comprados</summary>
                          <ul style={{ margin: '0.5rem 0 0 1rem', padding: 0, color: 'var(--text)' }}>
                            {items.map((item: any) => (
                              <li key={item.id} style={{ marginBottom: '0.2rem' }}>
                                <span style={{ color: 'var(--gold)' }}>{item.quantity}x</span> {item.name} - ${Number(item.price).toFixed(2)}
                              </li>
                            ))}
                          </ul>
                        </details>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ─── Mobile Cards ─── */}
      <div className="mobile-only mobile-card-grid" style={{ paddingBottom: '2rem' }}>
        {initialOrders.map(o => (
          <div key={o.id} className="mobile-data-card" onClick={() => setSelectedOrder(o)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={selectedIds.has(o.id)} onChange={e => { e.stopPropagation(); toggleOne(o.id); }} style={{ width: '16px', height: '16px', accentColor: 'var(--gold)' }} onClick={e => e.stopPropagation()} />
                <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '0.95rem', fontFamily: 'monospace' }}>{o.order_number}</span>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text)' }}>{o.user_name}</strong>
              </div>
              <span className={`status-badge ${STATUS_CLASS[o.status] || ''}`} style={{ transform: 'scale(0.85)', transformOrigin: 'right center' }}>{o.status}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.8rem', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Método: {o.payment_method}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }} onClick={e => e.stopPropagation()}>
                <AdminOrderActions orderId={o.id} currentStatus={o.status} />
                <strong style={{ color: 'var(--gold)', fontSize: '0.9rem' }}>${Number(o.total).toFixed(2)}</strong>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Pagination ─── */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1rem', marginBottom: '2rem' }}>
          <button onClick={() => updateURL({ page: String(currentPage - 1) })} disabled={currentPage === 1} className="btn-outline" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.4 : 1, borderRadius: '8px', minHeight: '38px' }}>
            ◀ Anterior
          </button>
          <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Página <span style={{ color: 'var(--gold)' }}>{currentPage}</span> de {totalPages}
          </span>
          <button onClick={() => updateURL({ page: String(currentPage + 1) })} disabled={currentPage === totalPages} className="btn-outline" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.4 : 1, borderRadius: '8px', minHeight: '38px' }}>
            Siguiente ▶
          </button>
        </div>
      )}

      {/* ─── Order Detail Drawer ─── */}
      {selectedOrder && (
        <div className="drawer-backdrop" onClick={() => setSelectedOrder(null)}>
          <div className="drawer-content" onClick={e => e.stopPropagation()}>
            <div className="drawer-handle" />
            <button className="drawer-close-btn" onClick={() => setSelectedOrder(null)}>✕</button>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--gold)' }}>📦 Detalle del Pedido</h3>
              <button
                type="button"
                onClick={() => handlePrintTicket(selectedOrder)}
                style={{
                  background: 'rgba(212,175,55,0.1)',
                  color: 'var(--gold)',
                  border: '1.5px solid var(--gold)',
                  borderRadius: '8px',
                  padding: '4px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.2s',
                  minHeight: '32px'
                }}
              >
                🖨️ Imprimir Ticket
              </button>
            </div>
            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Código de Pedido</span>
              <span className="drawer-detail-value" style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '1.05rem', fontFamily: 'monospace' }}>{selectedOrder.order_number}</span>
            </div>
            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Cliente</span>
              <span className="drawer-detail-value"><strong>{selectedOrder.user_name}</strong> ({selectedOrder.user_email})</span>
            </div>
            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Monto Total</span>
              <span className="drawer-detail-value" style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '1.1rem' }}>${Number(selectedOrder.total).toFixed(2)}</span>
            </div>
            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Método de Pago</span>
              <span className="drawer-detail-value">{selectedOrder.payment_method}</span>
            </div>
            {selectedOrder.shipping_method && (
              <div className="drawer-detail-row">
                <span className="drawer-detail-label">Método de Envío</span>
                <span className="drawer-detail-value">{selectedOrder.shipping_method} {Number(selectedOrder.shipping_cost || 0) > 0 ? `($${Number(selectedOrder.shipping_cost).toFixed(2)})` : '(Gratis)'}</span>
              </div>
            )}
            {(selectedOrder.shipping_address || selectedOrder.shipping_city) && (
              <div className="drawer-detail-row">
                <span className="drawer-detail-label">Dirección de Entrega</span>
                <span className="drawer-detail-value">{selectedOrder.shipping_address || ''} {selectedOrder.shipping_city ? `— ${selectedOrder.shipping_city}` : ''}</span>
              </div>
            )}
            {selectedOrder.customer_message && (
              <div className="drawer-detail-row">
                <span className="drawer-detail-label">Mensaje del Cliente</span>
                <span className="drawer-detail-value">📝 {selectedOrder.customer_message}</span>
              </div>
            )}
            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Fecha</span>
              <span className="drawer-detail-value">{new Date(selectedOrder.created_at).toLocaleString('es-VE')}</span>
            </div>
            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Estado</span>
              <span className="drawer-detail-value"><span className={`status-badge ${STATUS_CLASS[selectedOrder.status] || ''}`}>{selectedOrder.status}</span></span>
            </div>
            <div style={{ marginTop: '1.2rem', marginBottom: '1.2rem' }}>
              <span className="drawer-detail-label" style={{ marginBottom: '0.4rem', display: 'block' }}>Productos Adquiridos</span>
              <div style={{ background: 'var(--bg3)', borderRadius: '8px', padding: '0.8rem', border: '1px solid var(--border)' }}>
                {(() => {
                  let items: any[] = [];
                  try { items = selectedOrder.items_json ? JSON.parse(selectedOrder.items_json) : []; } catch { /* ignore */ }
                  if (items.length === 0) return <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ninguno.</div>;
                  return <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem', color: 'var(--text)' }}>
                    {items.map((item: any) => <li key={item.id} style={{ marginBottom: '0.4rem' }}><span style={{ color: 'var(--gold)', fontWeight: 700 }}>{item.quantity}x</span> {item.name} — <span style={{ color: 'var(--text-muted)' }}>${Number(item.price).toFixed(2)} c/u</span></li>)}
                  </ul>;
                })()}
              </div>
            </div>
            {selectedOrder.payment_proof && (
              <div className="drawer-detail-row" style={{ marginTop: '1rem' }}>
                <span className="drawer-detail-label" style={{ marginBottom: '0.4rem', display: 'block' }}>Comprobante de Pago</span>
                <a href={getReceiptUrl(selectedOrder.payment_proof)} target="_blank" rel="noopener noreferrer">
                  <img src={getReceiptUrl(selectedOrder.payment_proof)} alt="Comprobante" style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain', borderRadius: '6px', border: '1px solid var(--border)' }} />
                </a>
              </div>
            )}
            {/* Notes field */}
            <div style={{ marginTop: '1.2rem', marginBottom: '1.2rem', borderTop: '1px solid var(--border)', paddingTop: '1.2rem' }}>
              <label htmlFor="admin-notes-textarea" className="drawer-detail-label" style={{ marginBottom: '0.4rem', display: 'block', fontWeight: 600 }}>Notas de Administrador</label>
              <textarea
                id="admin-notes-textarea"
                value={editingNotes}
                onChange={e => setEditingNotes(e.target.value)}
                placeholder="Escribe notas internas sobre el pedido..."
                style={{
                  width: '100%',
                  minHeight: '80px',
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text)',
                  padding: '0.6rem',
                  fontSize: '0.85rem',
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'inherit'
                }}
              />
              <button
                onClick={handleSaveNotes}
                disabled={savingNotes || editingNotes === (selectedOrder?.admin_notes || '')}
                className="btn-primary"
                style={{
                  marginTop: '0.5rem',
                  padding: '0.4rem 1rem',
                  fontSize: '0.8rem',
                  minHeight: '32px',
                  alignSelf: 'flex-start',
                  opacity: (savingNotes || editingNotes === (selectedOrder?.admin_notes || '')) ? 0.5 : 1,
                  cursor: (savingNotes || editingNotes === (selectedOrder?.admin_notes || '')) ? 'default' : 'pointer'
                }}
              >
                {savingNotes ? 'Guardando...' : 'Guardar Nota'}
              </button>
            </div>

            <div style={{ marginTop: '1.8rem', paddingTop: '1.2rem', borderTop: '1px solid var(--border)', paddingBottom: '10rem' }}>
              <span className="drawer-detail-label" style={{ marginBottom: '0.6rem', display: 'block' }}>Gestionar Estado del Pedido</span>
              <AdminOrderActions orderId={selectedOrder.id} currentStatus={selectedOrder.status} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
