'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/context/ToastContext';

type Order = {
  id: number;
  order_number: string;
  status: string;
  total: number;
  subtotal: number;
  payment_method: string;
  payment_ref: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  customer_cedula: string;
  items_summary: string;
};

type Movement = {
  id: number;
  movement_type: string;
  quantity_change: number;
  previous_stock: number;
  new_stock: number;
  reference_id: string;
  notes: string;
  created_at: string;
  product_name: string;
  current_stock: number;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:    { label: 'Pendiente',   color: '#f39c12' },
  paid:       { label: 'Pagado',      color: '#27ae60' },
  processing: { label: 'Procesando', color: '#2980b9' },
  shipped:    { label: 'Enviado',    color: '#8e44ad' },
  delivered:  { label: 'Entregado',  color: '#16a085' },
  cancelled:  { label: 'Cancelado',  color: '#e74c3c' },
};

const MOVEMENT_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  sale:              { label: 'Venta',           icon: '🛒', color: '#e74c3c' },
  cancellation:      { label: 'Cancelación',     icon: '↩️', color: '#f39c12' },
  uncancellation:    { label: 'Reactivación',    icon: '✅', color: '#e74c3c' },
  manual_adjustment: { label: 'Ajuste Manual',   icon: '🔧', color: '#3498db' },
};

const PAGE_SIZE = 15;

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('es-VE', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(amount: number) {
  return `$${Number(amount).toFixed(2)}`;
}

export default function HistoryPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'sales' | 'movements'>('sales');
  const [orders, setOrders] = useState<Order[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [debouncedDateFrom, setDebouncedDateFrom] = useState('');
  const [debouncedDateTo, setDebouncedDateTo] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [serverStats, setServerStats] = useState<Record<string, any>>({});
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null);

  // Debounce search term to avoid immediate queries on typing
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Debounce date fields
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedDateFrom(dateFrom);
      setDebouncedDateTo(dateTo);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [dateFrom, dateTo]);

  const handleExportCSV = () => {
    setExportLoading(true);
    const params = new URLSearchParams({
      tab: activeTab,
      search: debouncedSearch,
      status: statusFilter,
      type: typeFilter,
      dateFrom: debouncedDateFrom,
      dateTo: debouncedDateTo
    });
    const url = `/api/admin/history/export?${params.toString()}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setExportLoading(false), 2000);
  };

  const fetchData = useCallback(async (
    tab: 'sales' | 'movements',
    pageNum: number,
    searchVal: string,
    statusVal: string,
    typeVal: string,
    df: string,
    dt: string
  ) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        tab,
        page: pageNum.toString(),
        limit: PAGE_SIZE.toString(),
        search: searchVal,
        status: statusVal,
        type: typeVal,
        dateFrom: df,
        dateTo: dt
      });

      const res = await fetch(`/api/admin/history?${queryParams.toString()}`);
      const data = await res.json() as any;
      if (res.ok) {
        if (tab === 'sales') {
          setOrders(data.orders || []);
          setTotalItems(data.totalItems || 0);
          setServerStats(prev => ({ ...prev, ...data.stats }));
        } else if (tab === 'movements') {
          setMovements(data.movements || []);
          setTotalItems(data.totalItems || 0);
          setServerStats(prev => ({ ...prev, ...data.stats }));
        }
      } else {
        showToast(data.error || 'Error al obtener historial.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error de red al obtener historial.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Fetch when tab, page, or filters change
  useEffect(() => {
    fetchData(activeTab, page, debouncedSearch, statusFilter, typeFilter, debouncedDateFrom, debouncedDateTo);
  }, [activeTab, page, debouncedSearch, statusFilter, typeFilter, debouncedDateFrom, debouncedDateTo, fetchData]);

  // Clean paginated records alias
  const pagedOrders = orders;
  const pagedMovements = movements;

  const activeTotal = totalItems;
  const totalPages = Math.max(1, Math.ceil(activeTotal / PAGE_SIZE));

  // Stats calculation
  const totalSales = serverStats.total_revenue ?? 0;
  const totalOrders = serverStats.total_orders ?? 0;
  const cancelledOrders = serverStats.cancelled_orders ?? 0;
  const totalMovements = serverStats.total_movements ?? 0;

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          📈 Historial General
        </h1>
        <p style={{ color: 'var(--text-muted)', margin: '0.3rem 0 0', fontSize: '0.9rem' }}>
          Auditoría de ventas, cobros y movimientos de stock físico.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.2rem', marginBottom: '2rem' }}>
        <div className="stat-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', padding: '1.5rem', borderRadius: '8px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Ingresos Totales (excl. Cancelados)</span>
          <h2 style={{ fontSize: '1.8rem', color: 'var(--gold)', margin: '0.5rem 0 0', fontWeight: 700 }}>
            {formatMoney(totalSales)}
          </h2>
        </div>
        <div className="stat-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', padding: '1.5rem', borderRadius: '8px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Órdenes Totales</span>
          <h2 style={{ fontSize: '1.8rem', color: 'var(--text)', margin: '0.5rem 0 0', fontWeight: 700 }}>
            {totalOrders}
          </h2>
        </div>
        <div className="stat-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', padding: '1.5rem', borderRadius: '8px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Órdenes Canceladas</span>
          <h2 style={{ fontSize: '1.8rem', color: 'var(--error)', margin: '0.5rem 0 0', fontWeight: 700 }}>
            {cancelledOrders}
          </h2>
        </div>
        <div className="stat-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', padding: '1.5rem', borderRadius: '8px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Ajustes de Inventario</span>
          <h2 style={{ fontSize: '1.8rem', color: 'var(--primary)', margin: '0.5rem 0 0', fontWeight: 700 }}>
            {totalMovements}
          </h2>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('sales')}
          className={`tab-btn ${activeTab === 'sales' ? 'active' : ''}`}
          style={{
            padding: '0.6rem 1.2rem',
            background: activeTab === 'sales' ? 'var(--primary)' : 'none',
            border: 'none',
            borderRadius: '6px',
            color: activeTab === 'sales' ? '#fff' : 'var(--text-muted)',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.9rem'
          }}
        >
          🛒 Ventas / Órdenes
        </button>
        <button
          onClick={() => setActiveTab('movements')}
          className={`tab-btn ${activeTab === 'movements' ? 'active' : ''}`}
          style={{
            padding: '0.6rem 1.2rem',
            background: activeTab === 'movements' ? 'var(--primary)' : 'none',
            border: 'none',
            borderRadius: '6px',
            color: activeTab === 'movements' ? '#fff' : 'var(--text-muted)',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.9rem'
          }}
        >
          🔄 Movimientos de Stock
        </button>
      </div>

      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' }}>
        <div className="search-input-wrapper" style={{ flex: 1, minWidth: '240px' }}>
          <input
            type="text"
            placeholder={activeTab === 'sales' ? "Buscar por orden, cliente, correo, cédula o items..." : "Buscar por producto, referencia o notas..."}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ width: '100%', padding: '0.6rem 1rem', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)' }}
          />
        </div>

        {activeTab === 'sales' ? (
          <div className="filter-group">
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              style={{ padding: '0.6rem 1rem', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)' }}
            >
              <option value="">Todos los Estados</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="filter-group">
            <select
              value={typeFilter}
              onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
              style={{ padding: '0.6rem 1rem', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)' }}
            >
              <option value="">Todas las Transacciones</option>
              {Object.entries(MOVEMENT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Date Filters */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Desde:</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            style={{ padding: '0.6rem 0.8rem', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '0.85rem', outline: 'none' }}
          />
          <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Hasta:</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            style={{ padding: '0.6rem 0.8rem', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '0.85rem', outline: 'none' }}
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              style={{ padding: '0.4rem 0.6rem', background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              ✕
            </button>
          )}
        </div>

        {/* CSV Export Button */}
        <button
          onClick={handleExportCSV}
          disabled={exportLoading}
          style={{
            padding: '0.6rem 1rem',
            background: 'rgba(212,175,55,0.1)',
            color: 'var(--gold)',
            border: '1px solid rgba(212,175,55,0.4)',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.85rem',
            outline: 'none',
            minHeight: '38px'
          }}
        >
          {exportLoading ? '⏳' : '⬇️'} CSV
        </button>
      </div>

      {/* Table Card container */}
      <div className="table-card" style={{ position: 'relative' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            Cargando historial...
          </div>
        ) : activeTab === 'sales' ? (
          <>
            <div className="desktop-only">
              <table>
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th>Cliente</th>
                    <th>Detalle de Productos</th>
                    <th>Monto</th>
                    <th>Método Pago</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No se encontraron registros de ventas.
                      </td>
                    </tr>
                  ) : (
                    pagedOrders.map(o => (
                      <tr key={o.id}>
                        <td>
                          <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '0.85rem' }}>
                            {o.order_number}
                          </span>
                        </td>
                        <td className="allow-wrap">
                          <strong>{o.customer_name || 'Desconocido'}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{o.customer_email || 'Sin correo'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>C.I.: {o.customer_cedula || 'N/A'}</div>
                        </td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '350px' }} className="allow-wrap">
                          {o.items_summary || 'Sin descripción'}
                        </td>
                        <td style={{ color: 'var(--gold)', fontWeight: 700 }}>
                          {formatMoney(o.total)}
                        </td>
                        <td style={{ fontSize: '0.82rem' }}>
                          {o.payment_method}
                          {o.payment_ref ? <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Ref: {o.payment_ref}</div> : null}
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {formatDate(o.created_at)}
                        </td>
                        <td>
                          <span className={`status-badge`} style={{
                            background: (STATUS_LABELS[o.status] || { color: 'var(--border)' }).color + '22',
                            color: (STATUS_LABELS[o.status] || { color: 'var(--text)' }).color,
                            border: `1px solid ${(STATUS_LABELS[o.status] || { color: 'var(--border)' }).color}`
                          }}>
                            {(STATUS_LABELS[o.status] || { label: o.status }).label}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mobile-only mobile-card-grid">
              {pagedOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No se encontraron registros de ventas.
                </div>
              ) : (
                pagedOrders.map(o => (
                  <div key={o.id} className="mobile-data-card" onClick={() => setSelectedOrder(o)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '0.9rem', fontFamily: 'monospace' }}>{o.order_number}</span>
                      <span className={`status-badge`} style={{
                        transform: 'scale(0.85)',
                        transformOrigin: 'right center',
                        background: (STATUS_LABELS[o.status] || { color: 'var(--border)' }).color + '22',
                        color: (STATUS_LABELS[o.status] || { color: 'var(--text)' }).color,
                        border: `1px solid ${(STATUS_LABELS[o.status] || { color: 'var(--border)' }).color}`
                      }}>
                        {(STATUS_LABELS[o.status] || { label: o.status }).label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.8rem', fontSize: '0.8rem' }}>
                      <strong style={{ color: 'var(--text)' }}>{o.customer_name || 'Desconocido'}</strong>
                      <strong style={{ color: 'var(--gold)', fontSize: '0.9rem' }}>{formatMoney(o.total)}</strong>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <div className="desktop-only">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Operación</th>
                    <th>Cambio</th>
                    <th>Stock Previo</th>
                    <th>Stock Nuevo</th>
                    <th>Referencia</th>
                    <th>Anotaciones</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedMovements.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No se encontraron movimientos de inventario.
                      </td>
                    </tr>
                  ) : (
                    pagedMovements.map(m => {
                      const label = MOVEMENT_LABELS[m.movement_type] || { label: m.movement_type, icon: '📦', color: '#fff' };
                      const isPositive = m.quantity_change > 0;
                      return (
                        <tr key={m.id}>
                          <td>
                            <strong>{m.product_name || 'Producto Desconocido'}</strong>
                          </td>
                          <td>
                            <span style={{ color: label.color, fontSize: '0.85rem' }}>
                              {label.icon} {label.label}
                            </span>
                          </td>
                          <td style={{ color: isPositive ? 'var(--success)' : 'var(--error)', fontWeight: 700 }}>
                            {isPositive ? `+${m.quantity_change}` : m.quantity_change}
                          </td>
                          <td style={{ color: 'var(--text-muted)' }}>
                            {m.previous_stock}
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            {m.new_stock}
                          </td>
                          <td>
                            <code style={{ background: 'var(--bg3)', padding: '0.2rem 0.4rem', borderRadius: '4px', fontSize: '0.78rem', color: 'var(--primary)', fontFamily: 'monospace' }}>
                              {m.reference_id || 'Ajuste'}
                            </code>
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '250px' }} className="allow-wrap">
                            {m.notes || '—'}
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {formatDate(m.created_at)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="mobile-only mobile-card-grid">
              {pagedMovements.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No se encontraron movimientos de inventario.
                </div>
              ) : (
                pagedMovements.map(m => {
                  const label = MOVEMENT_LABELS[m.movement_type] || { label: m.movement_type, icon: '📦', color: '#fff' };
                  const isPositive = m.quantity_change > 0;
                  return (
                    <div key={m.id} className="mobile-data-card" onClick={() => setSelectedMovement(m)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '0.9rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>{m.product_name || 'Desconocido'}</strong>
                        <span style={{ color: label.color, fontSize: '0.8rem' }}>
                          {label.icon} {label.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.8rem', fontSize: '0.8rem' }}>
                        <code style={{ background: 'var(--bg3)', padding: '0.15rem 0.35rem', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--primary)', fontFamily: 'monospace' }}>
                          {m.reference_id || 'Ajuste'}
                        </code>
                        <strong style={{ color: isPositive ? 'var(--success)' : 'var(--error)', fontSize: '0.9rem' }}>
                          {isPositive ? `+${m.quantity_change}` : m.quantity_change}
                        </strong>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Pagination Controls */}
        {!loading && activeTotal > PAGE_SIZE && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Página {page} de {totalPages} ({activeTotal} resultados)
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                style={{ padding: '0.4rem 0.8rem', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '6px', color: page === 1 ? 'var(--text-muted)' : 'var(--text)', cursor: page === 1 ? 'default' : 'pointer', fontSize: '0.85rem' }}
              >
                ← Anterior
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                style={{ padding: '0.4rem 0.8rem', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '6px', color: page === totalPages ? 'var(--text-muted)' : 'var(--text)', cursor: page === totalPages ? 'default' : 'pointer', fontSize: '0.85rem' }}
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sales Detail Drawer */}
      {selectedOrder && (
        <div className="drawer-backdrop" onClick={() => setSelectedOrder(null)}>
          <div className="drawer-content" onClick={e => e.stopPropagation()}>
            <div className="drawer-handle" />
            <button className="drawer-close-btn" onClick={() => setSelectedOrder(null)}>✕</button>
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.2rem', fontWeight: 700, color: 'var(--gold)' }}>📈 Detalle de Venta</h3>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Orden</span>
              <span className="drawer-detail-value" style={{ color: 'var(--gold)', fontWeight: 700, fontFamily: 'monospace' }}>{selectedOrder.order_number}</span>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Cliente</span>
              <span className="drawer-detail-value">
                <strong>{selectedOrder.customer_name || 'Desconocido'}</strong>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Email: {selectedOrder.customer_email || '—'}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>C.I.: {selectedOrder.customer_cedula || '—'}</div>
              </span>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Monto Total</span>
              <span className="drawer-detail-value" style={{ color: 'var(--gold)', fontWeight: 700 }}>{formatMoney(selectedOrder.total)}</span>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Método de Pago</span>
              <span className="drawer-detail-value">
                {selectedOrder.payment_method}
                {selectedOrder.payment_ref ? <span style={{ color: 'var(--text-muted)' }}> (Ref: {selectedOrder.payment_ref})</span> : null}
              </span>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Productos Adquiridos</span>
              <span className="drawer-detail-value" style={{ lineHeight: '1.4' }}>{selectedOrder.items_summary || '—'}</span>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Fecha</span>
              <span className="drawer-detail-value">{formatDate(selectedOrder.created_at)}</span>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Estado</span>
              <span className="drawer-detail-value">
                <span className={`status-badge`} style={{
                  background: (STATUS_LABELS[selectedOrder.status] || { color: 'var(--border)' }).color + '22',
                  color: (STATUS_LABELS[selectedOrder.status] || { color: 'var(--text)' }).color,
                  border: `1px solid ${(STATUS_LABELS[selectedOrder.status] || { color: 'var(--border)' }).color}`
                }}>
                  {(STATUS_LABELS[selectedOrder.status] || { label: selectedOrder.status }).label}
                </span>
              </span>
            </div>
            
            <button className="btn-primary" onClick={() => setSelectedOrder(null)} style={{ width: '100%', padding: '0.8rem', fontSize: '0.9rem', justifyContent: 'center', marginTop: '1.5rem', minHeight: '44px', display: 'flex', alignItems: 'center' }}>
              Aceptar
            </button>
          </div>
        </div>
      )}

      {/* Movement Detail Drawer */}
      {selectedMovement && (
        <div className="drawer-backdrop" onClick={() => setSelectedMovement(null)}>
          <div className="drawer-content" onClick={e => e.stopPropagation()}>
            <div className="drawer-handle" />
            <button className="drawer-close-btn" onClick={() => setSelectedMovement(null)}>✕</button>
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.2rem', fontWeight: 700, color: 'var(--gold)' }}>🔄 Detalle del Movimiento</h3>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Producto</span>
              <span className="drawer-detail-value" style={{ fontWeight: 700 }}>{selectedMovement.product_name || 'Producto Desconocido'}</span>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Operación</span>
              <span className="drawer-detail-value">
                {(() => {
                  const label = MOVEMENT_LABELS[selectedMovement.movement_type] || { label: selectedMovement.movement_type, icon: '📦', color: '#fff' };
                  return (
                    <span style={{ color: label.color }}>
                      {label.icon} {label.label}
                    </span>
                  );
                })()}
              </span>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Cambio en Stock</span>
              <span className="drawer-detail-value" style={{ color: selectedMovement.quantity_change > 0 ? 'var(--success)' : 'var(--error)', fontWeight: 700 }}>
                {selectedMovement.quantity_change > 0 ? `+${selectedMovement.quantity_change}` : selectedMovement.quantity_change}
              </span>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Stock Anterior</span>
              <span className="drawer-detail-value">{selectedMovement.previous_stock}</span>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Stock Nuevo</span>
              <span className="drawer-detail-value" style={{ fontWeight: 600 }}>{selectedMovement.new_stock}</span>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Referencia</span>
              <span className="drawer-detail-value">
                <code style={{ background: 'var(--bg3)', padding: '0.2rem 0.4rem', borderRadius: '4px', fontSize: '0.85rem', color: 'var(--primary)', fontFamily: 'monospace' }}>
                  {selectedMovement.reference_id || 'Ajuste'}
                </code>
              </span>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Anotaciones</span>
              <span className="drawer-detail-value" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{selectedMovement.notes || 'Sin anotaciones.'}</span>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Fecha</span>
              <span className="drawer-detail-value">{formatDate(selectedMovement.created_at)}</span>
            </div>

            <button className="btn-primary" onClick={() => setSelectedMovement(null)} style={{ width: '100%', padding: '0.8rem', fontSize: '0.9rem', justifyContent: 'center', marginTop: '1.5rem', minHeight: '44px', display: 'flex', alignItems: 'center' }}>
              Aceptar
            </button>
          </div>
        </div>
      )}
      </div>
  );
}
