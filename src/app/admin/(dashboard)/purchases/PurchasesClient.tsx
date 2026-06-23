'use client';
import React, { useState, useEffect } from 'react';
import { useToast } from '@/context/ToastContext';
import { useRouter, useSearchParams } from 'next/navigation';

interface Category {
  id: number;
  name: string;
}

interface Supplier {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
  category_id: number | null;
  barcode?: string | null;
  supplier_id?: number | null;
  min_stock_alert?: number | null;
}

interface PurchaseOrderItem {
  id: number;
  purchase_order_id: number;
  product_id: number | null;
  product_name: string;
  cost_price: number;
  quantity: number;
  retail_price?: number;
  slug?: string;
  current_stock?: number;
  barcode?: string | null;
}

interface PurchaseOrder {
  id: number;
  supplier_id: number;
  supplier_name: string;
  supplier_email?: string;
  supplier_phone?: string;
  status: 'pending' | 'received' | 'cancelled';
  total_cost: number;
  notes: string | null;
  created_at: string;
  received_at: string | null;
}

export default function PurchasesClient({ categories }: { categories: Category[] }) {
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Detailed Modal State
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<PurchaseOrderItem[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [cartItems, setCartItems] = useState<any[]>([]);

  // Product Selection / Quick pre-register State
  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [itemCost, setItemCost] = useState('');
  
  const [isPreRegOpen, setIsPreRegOpen] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdCost, setNewProdCost] = useState('');
  const [newProdRetail, setNewProdRetail] = useState('');
  const [newProdCatId, setNewProdCatId] = useState('');

  // Barcode integration in purchases
  const [purchaseBarcode, setPurchaseBarcode] = useState('');
  const [receiveBarcode, setReceiveBarcode] = useState('');
  const [receivedCounts, setReceivedCounts] = useState<Record<number, number>>({});

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

  const fetchData = async () => {
    setLoading(true);
    try {
      const statusParam = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const [poRes, sRes, pRes] = await Promise.all([
        fetch(`/api/admin/purchase-orders${statusParam}`),
        fetch('/api/admin/suppliers'),
        fetch('/api/admin/products')
      ]);

      const poData = (await poRes.json()) as any;
      const sData = (await sRes.json()) as any;
      const pData = (await pRes.json()) as any;

      if (poData.success) setPurchaseOrders(poData.purchaseOrders || []);
      if (sData.success) setSuppliers(sData.suppliers || []);
      if (pData.success) setProducts(pData.products || []);

    } catch (err) {
      console.error(err);
      showToast('Error de red al cargar compras.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  useEffect(() => {
    if (loading || products.length === 0 || suppliers.length === 0) return;

    const reorderProductId = searchParams.get('reorder_product_id');
    const supplierId = searchParams.get('supplier_id');
    const qtyStr = searchParams.get('qty') || '10';

    if (reorderProductId) {
      const pId = parseInt(reorderProductId, 10);
      const prod = products.find(p => p.id === pId);
      if (prod) {
        // Pre-select supplier
        if (supplierId) {
          setSelectedSupplierId(supplierId);
        }
        
        // Add to cart
        const qty = parseInt(qtyStr, 10) || 10;
        // Estimate cost price as 70% of retail or check if we can get a realistic cost
        const estimatedCost = parseFloat((prod.price * 0.7).toFixed(2));
        
        setCartItems([{
          product_id: prod.id,
          product_name: prod.name,
          cost_price: estimatedCost,
          quantity: qty
        }]);

        // Open modal
        setIsCreateOpen(true);

        // Clear query parameters to avoid re-opening modal on refresh
        const url = new URL(window.location.href);
        url.searchParams.delete('reorder_product_id');
        url.searchParams.delete('supplier_id');
        url.searchParams.delete('qty');
        window.history.replaceState(null, '', url.pathname + url.search);
      }
    }
  }, [loading, products, suppliers, searchParams]);

  const openCreateModal = () => {
    setSelectedSupplierId('');
    setNotes('');
    setCartItems([]);
    setSelectedProductId('');
    setItemQuantity('1');
    setItemCost('');
    setIsCreateOpen(true);
  };

  const handleOpenDetail = async (order: PurchaseOrder) => {
    setSelectedOrder(order);
    setReceivedCounts({});
    setReceiveBarcode('');
    setLoadingDetails(true);
    setIsDetailOpen(true);
    try {
      const res = await fetch(`/api/admin/purchase-orders/${order.id}`);
      const data = (await res.json()) as any;
      if (data.success) {
        setSelectedOrderItems(data.items || []);
      } else {
        showToast(data.error || 'Error al obtener detalles.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al obtener detalles.', 'error');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleAddToOrderCart = () => {
    if (!selectedProductId) return showToast('Selecciona un producto.', 'error');
    const prod = products.find(p => p.id === parseInt(selectedProductId, 10));
    if (!prod) return;

    const qty = parseInt(itemQuantity, 10);
    const cost = parseFloat(itemCost);

    if (isNaN(qty) || qty <= 0) return showToast('Cantidad inválida.', 'error');
    if (isNaN(cost) || cost < 0) return showToast('Costo inválido.', 'error');

    // Check if product already in cart
    const existingIdx = cartItems.findIndex(i => i.product_id === prod.id);
    if (existingIdx > -1) {
      const newItems = [...cartItems];
      newItems[existingIdx].quantity += qty;
      setCartItems(newItems);
    } else {
      setCartItems([...cartItems, {
        product_id: prod.id,
        product_name: prod.name,
        cost_price: cost,
        quantity: qty
      }]);
    }

    // Reset item inputs
    setSelectedProductId('');
    setItemQuantity('1');
    setItemCost('');
  };

  const handleAddPreRegToCart = () => {
    if (!newProdName.trim()) return showToast('El nombre del producto es obligatorio.', 'error');
    const cost = parseFloat(newProdCost);
    const retail = parseFloat(newProdRetail);
    
    if (isNaN(cost) || cost < 0) return showToast('Costo de compra inválido.', 'error');
    if (isNaN(retail) || retail < 0) return showToast('Precio de venta inválido.', 'error');

    // Add to cart as a "new product to pre-register"
    setCartItems([...cartItems, {
      product_id: null, // signifies new product
      product_name: newProdName.trim(),
      cost_price: cost,
      quantity: 1, // default quantity 1, can edit in cart list
      retail_price: retail,
      category_id: newProdCatId || null
    }]);

    setIsPreRegOpen(false);
    setNewProdName('');
    setNewProdCost('');
    setNewProdRetail('');
    setNewProdCatId('');
  };

  const handleRemoveFromCart = (index: number) => {
    setCartItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateCartQty = (index: number, val: string) => {
    const qty = parseInt(val, 10);
    if (!isNaN(qty) && qty > 0) {
      const newItems = [...cartItems];
      newItems[index].quantity = qty;
      setCartItems(newItems);
    }
  };

  const handleUpdateCartCost = (index: number, val: string) => {
    const cost = parseFloat(val);
    if (!isNaN(cost) && cost >= 0) {
      const newItems = [...cartItems];
      newItems[index].cost_price = cost;
      setCartItems(newItems);
    }
  };

  const lowStockCountForSupplier = React.useMemo(() => {
    if (!selectedSupplierId) return 0;
    const supplierIdNum = parseInt(selectedSupplierId, 10);
    return products.filter(p => p.supplier_id === supplierIdNum && p.stock <= (p.min_stock_alert ?? 3)).length;
  }, [selectedSupplierId, products]);

  const handleAutoFillLowStock = () => {
    if (!selectedSupplierId) return;
    const supplierIdNum = parseInt(selectedSupplierId, 10);
    const lowStockProds = products.filter(p => p.supplier_id === supplierIdNum && p.stock <= (p.min_stock_alert ?? 3));
    if (lowStockProds.length === 0) {
      return showToast('No hay productos de este proveedor con stock crítico.', 'info');
    }

    let addedCount = 0;
    let updatedCount = 0;
    const newCart = [...cartItems];

    lowStockProds.forEach(prod => {
      const existingIdx = newCart.findIndex(item => item.product_id === prod.id);
      const estimatedCost = parseFloat((prod.price * 0.7).toFixed(2));
      const replenishQty = Math.max(10, (prod.min_stock_alert ?? 3) * 3 - prod.stock);

      if (existingIdx > -1) {
        newCart[existingIdx].quantity += replenishQty;
        updatedCount++;
      } else {
        newCart.push({
          product_id: prod.id,
          product_name: prod.name,
          cost_price: estimatedCost,
          quantity: replenishQty
        });
        addedCount++;
      }
    });

    setCartItems(newCart);
    showToast(`⚡ Se agregaron ${addedCount} productos y se actualizaron ${updatedCount} en el carrito.`, 'success');
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) return showToast('Selecciona un proveedor.', 'error');
    if (cartItems.length === 0) return showToast('Debe agregar al menos un producto a la orden.', 'error');

    setSaving(true);
    try {
      const res = await fetch('/api/admin/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: selectedSupplierId,
          notes: notes.trim(),
          items: cartItems
        })
      });

      const data = (await res.json()) as any;
      if (res.ok) {
        showToast('✅ Orden de compra registrada correctamente.', 'success');
        setIsCreateOpen(false);
        fetchData();
        router.refresh();
      } else {
        showToast(data.error || 'Error al registrar orden de compra.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al guardar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (orderId: number, targetStatus: 'received' | 'cancelled') => {
    if (targetStatus === 'received') {
      const hasDiscrepancy = selectedOrderItems.some(item => (receivedCounts[item.id] || 0) !== item.quantity);
      if (hasDiscrepancy) {
        if (!confirm('⚠️ ¡Atención! Los conteos escaneados no coinciden exactamente con las cantidades ordenadas. ¿Deseas registrar la recepción de la mercancía con las cantidades de la orden original?')) {
          return;
        }
      }
    }

    const confirmMsg = targetStatus === 'received'
      ? '¿Estás seguro de marcar esta orden como RECIBIDA? Esto incrementará de forma irreversible el stock de los productos e integrará al catálogo público los productos nuevos pre-registrados.'
      : '¿Estás seguro de CANCELAR esta orden de compra?';
    
    if (!confirm(confirmMsg)) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/purchase-orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus })
      });
      const data = (await res.json()) as any;
      if (res.ok) {
        showToast(data.message || 'Estado actualizado correctamente.', 'success');
        setIsDetailOpen(false);
        fetchData();
        router.refresh();
      } else {
        showToast(data.error || 'Error al actualizar el estado.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al actualizar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const filteredOrders = purchaseOrders.filter(po =>
    po.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
    (po.notes || '').toLowerCase().includes(search.toLowerCase()) ||
    String(po.id).includes(search)
  );

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':   return '⏳ Pendiente';
      case 'received':  return '🟢 Recibido';
      case 'cancelled': return '🔴 Cancelado';
      default:          return status;
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pending':   return { background: 'rgba(241,196,15,0.15)', color: '#F1C40F' };
      case 'received':  return { background: 'rgba(39,174,96,0.15)', color: '#27AE60' };
      case 'cancelled': return { background: 'rgba(231,76,60,0.15)', color: '#E74C3C' };
      default:          return {};
    }
  };

  return (
    <div style={{ padding: '1.5rem', color: 'var(--text)', background: 'var(--bg-main)', minHeight: '100vh' }}>
      {/* Topbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--primary, var(--gold))', margin: 0 }}>📥 Órdenes de Compra</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.2rem 0 0 0' }}>Planifica tus compras a proveedores, pre-registra productos sin existencias y da entrada formal a tu inventario.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="btn-primary"
          style={{
            padding: '0.6rem 1.2rem',
            fontSize: '0.85rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          ➕ Agendar Compra
        </button>
      </div>

      {/* Filters and search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flex: 1, maxWidth: '600px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="🔍 Buscar compra por proveedor, notas o ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '0.6rem 1rem',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--bg3)',
              color: 'var(--text)',
              fontSize: '0.88rem',
              outline: 'none'
            }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '0.6rem 1rem',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--bg3)',
              color: 'var(--text)',
              fontSize: '0.88rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all">📁 Todos los estados</option>
            <option value="pending">⏳ Pendiente</option>
            <option value="received">🟢 Recibido</option>
            <option value="cancelled">🔴 Cancelado</option>
          </select>
        </div>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {filteredOrders.length} órdenes encontradas
        </span>
      </div>

      {/* Grid or Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          Cargando compras...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', background: 'var(--bg2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          No se encontraron órdenes de compra registradas.
        </div>
      ) : (
        <div className="table-responsive" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '1rem' }}>ID Compra</th>
                <th style={{ padding: '1rem' }}>Proveedor</th>
                <th style={{ padding: '1rem' }}>Fecha de Creación</th>
                <th style={{ padding: '1rem' }}>Llegada / Recepción</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Costo Total (USD)</th>
                <th style={{ padding: '1rem' }}>Estado</th>
                <th style={{ padding: '1rem' }}>Notas</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Detalles</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(po => (
                <tr key={po.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                  <td style={{ padding: '1rem', fontWeight: 'bold', fontFamily: 'monospace' }}>
                    #{po.id}
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 700 }}>{po.supplier_name}</td>
                  <td style={{ padding: '1rem', fontSize: '0.82rem' }}>{new Date(po.created_at).toLocaleString()}</td>
                  <td style={{ padding: '1rem', fontSize: '0.82rem', color: po.received_at ? 'var(--text)' : 'var(--text-muted)' }}>
                    {po.received_at ? new Date(po.received_at).toLocaleString() : '—'}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold' }}>
                    ${po.total_cost.toFixed(2)}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      ...getStatusStyle(po.status)
                    }}>
                      {getStatusLabel(po.status)}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={po.notes || ''}>
                    {po.notes || '—'}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <button
                      onClick={() => handleOpenDetail(po)}
                      style={{
                        cursor: 'pointer',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.8rem'
                      }}
                    >
                      👁️ Ver Detalles
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal de Detalle de la Orden ── */}
      {isDetailOpen && selectedOrder && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '1rem'
          }}
          onClick={() => setIsDetailOpen(false)}
        >
          <div
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              width: '100%',
              maxWidth: '650px',
              padding: '1.5rem',
              boxShadow: 'var(--shadow)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.8rem', marginBottom: '1.2rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                📋 Detalle de Orden de Compra #{selectedOrder.id}
              </h3>
              <button onClick={() => setIsDetailOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', fontSize: '0.88rem' }}>
              <div>
                <p style={{ margin: '0 0 0.3rem 0', color: 'var(--text-muted)' }}>Proveedor:</p>
                <strong style={{ fontSize: '0.95rem' }}>{selectedOrder.supplier_name}</strong>
                {selectedOrder.supplier_phone && <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)' }}>📞 Telf: {selectedOrder.supplier_phone}</p>}
                {selectedOrder.supplier_email && <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)' }}>✉️ Correo: {selectedOrder.supplier_email}</p>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: '0 0 0.3rem 0', color: 'var(--text-muted)' }}>Estado actual:</p>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  display: 'inline-block',
                  ...getStatusStyle(selectedOrder.status)
                }}>
                  {getStatusLabel(selectedOrder.status)}
                </span>
                <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Creado: {new Date(selectedOrder.created_at).toLocaleString()}</p>
                {selectedOrder.received_at && <p style={{ margin: '0.2rem 0 0 0', color: 'var(--success)', fontSize: '0.8rem' }}>Llegada: {new Date(selectedOrder.received_at).toLocaleString()}</p>}
              </div>
            </div>

            {selectedOrder.notes && (
              <div style={{ padding: '0.8rem', background: 'var(--bg3)', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                <strong>Notas de la compra:</strong>
                <p style={{ margin: '0.3rem 0 0 0', color: 'var(--text-muted)' }}>{selectedOrder.notes}</p>
              </div>
            )}

            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.8rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem' }}>📦 Ítems de la Compra</h4>
            
            {selectedOrder.status === 'pending' && !loadingDetails && (
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px dashed var(--border)', marginBottom: '1.2rem' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                  🚚 Recepción y Conteo Físico por Escaneo:
                </label>
                <input
                  type="text"
                  placeholder="Escanee el producto recibido..."
                  value={receiveBarcode}
                  onChange={e => {
                    const val = e.target.value;
                    setReceiveBarcode(val);
                    const code = val.trim();
                    if (code) {
                      const item = selectedOrderItems.find(i => i.barcode === code);
                      if (item) {
                        setReceivedCounts(prev => {
                          const current = prev[item.id] || 0;
                          const next = current + 1;
                          showToast(`Verificado: ${item.product_name} (${next}/${item.quantity})`, 'success');
                          playBeep('success');
                          return { ...prev, [item.id]: next };
                        });
                        setReceiveBarcode('');
                      } else {
                        const prodInCatalog = products.find(p => p.barcode === code);
                        if (prodInCatalog) {
                          showToast(`El producto "${prodInCatalog.name}" no pertenece a esta orden de compra.`, 'error');
                        } else {
                          showToast(`Código de barras "${code}" no reconocido en el catálogo.`, 'error');
                        }
                        playBeep('error');
                        setReceiveBarcode('');
                      }
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.8rem',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--text)',
                    outline: 'none',
                    fontSize: '0.82rem',
                    fontFamily: 'monospace'
                  }}
                />
              </div>
            )}

            {loadingDetails ? (
              <p style={{ color: 'var(--text-muted)' }}>Cargando ítems...</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
                {selectedOrderItems.map(item => (
                  <div
                    key={item.id}
                    style={{
                      background: 'var(--bg3)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '0.8rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <strong>{item.product_name}</strong>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Costo Unitario: ${item.cost_price.toFixed(2)} | Cantidad: {item.quantity} uds
                        {item.current_stock !== undefined && ` (Stock actual: ${item.current_stock})`}
                        {selectedOrder.status === 'pending' && (
                          <span style={{ marginLeft: '0.5rem', fontWeight: 700, color: (receivedCounts[item.id] || 0) === item.quantity ? '#2ecc71' : (receivedCounts[item.id] || 0) > item.quantity ? '#e67e22' : 'inherit' }}>
                            | Escaneado: {receivedCounts[item.id] || 0} / {item.quantity}
                            {(receivedCounts[item.id] || 0) === item.quantity && ' ✅'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
                      ${(item.cost_price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 0.5rem 0 0.5rem', fontSize: '1rem', borderTop: '1px solid var(--border)', marginTop: '0.5rem' }}>
                  <strong>Costo Total Estimado:</strong>
                  <strong style={{ color: 'var(--gold)', fontSize: '1.1rem' }}>${selectedOrder.total_cost.toFixed(2)}</strong>
                </div>
              </div>
            )}

            {/* Acciones de la compra (Solo si está pendiente) */}
            {selectedOrder.status === 'pending' && (
              <div style={{ display: 'flex', gap: '0.8rem', borderTop: '1px solid var(--border)', paddingTop: '1.2rem', marginTop: '1.5rem' }}>
                <button
                  onClick={() => handleUpdateStatus(selectedOrder.id, 'cancelled')}
                  disabled={saving}
                  style={{
                    flex: 1, padding: '0.75rem', background: 'rgba(231,76,60,0.1)', border: '1px solid var(--error)',
                    borderRadius: '8px', color: 'var(--error)', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600
                  }}
                >
                  ✕ Cancelar Compra
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedOrder.id, 'received')}
                  disabled={saving || loadingDetails}
                  style={{
                    flex: 2, padding: '0.75rem', background: 'var(--gold)', border: 'none',
                    borderRadius: '8px', color: '#000', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                  }}
                >
                  🚚 Marcar como Recibida (Llegada)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal de Creación de Orden ── */}
      {isCreateOpen && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9998, padding: '1rem'
          }}
          onClick={() => setIsCreateOpen(false)}
        >
          <div
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              width: '100%',
              maxWidth: '650px',
              padding: '1.5rem',
              boxShadow: 'var(--shadow)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.8rem', marginBottom: '1.2rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                📋 Agendar Nueva Compra (Reponer Stock)
              </h3>
              <button onClick={() => setIsCreateOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleCreateOrder} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              {/* Select Supplier */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Proveedor *</label>
                <select
                  required
                  value={selectedSupplierId}
                  onChange={e => setSelectedSupplierId(e.target.value)}
                  style={{
                    width: '100%', padding: '0.6rem 0.8rem', background: 'var(--bg3)',
                    border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', outline: 'none', fontSize: '0.88rem', cursor: 'pointer'
                  }}
                >
                  <option value="" disabled>Seleccione el proveedor...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {selectedSupplierId && (
                  <button
                    type="button"
                    onClick={handleAutoFillLowStock}
                    style={{
                      background: 'rgba(212,175,55,0.1)',
                      color: 'var(--gold)',
                      border: '1px solid var(--gold)',
                      borderRadius: '8px',
                      padding: '0.5rem 1rem',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      marginTop: '0.6rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    ⚡ Auto-Reordenar Stock Bajo ({lowStockCountForSupplier})
                  </button>
                )}
              </div>

              {/* Add Items Sub-form */}
              <div style={{ background: 'var(--bg3)', padding: '1rem', borderRadius: '10px', border: '1px dashed var(--border)' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--gold)', margin: '0 0 0.8rem 0', fontWeight: 700 }}>➕ Añadir Productos a la Compra</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {/* Barcode scan input for rapid addition */}
                  <div className="form-group" style={{ marginBottom: '0.4rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>⚡ Escaneo Rápido por Código de Barras</label>
                    <input
                      type="text"
                      placeholder="Escanee el producto aquí para agregarlo..."
                      value={purchaseBarcode}
                      onChange={e => {
                        const val = e.target.value;
                        setPurchaseBarcode(val);
                        const code = val.trim();
                        if (code) {
                          const prod = products.find(p => p.barcode === code);
                          if (prod) {
                            const estimatedCost = parseFloat((prod.price * 0.7).toFixed(2));
                            setCartItems(prev => {
                              const existingIdx = prev.findIndex(i => i.product_id === prod.id);
                              if (existingIdx > -1) {
                                const newItems = [...prev];
                                newItems[existingIdx].quantity += 1;
                                showToast(`Cantidad incrementada para: ${prod.name} (${newItems[existingIdx].quantity})`, 'success');
                                return newItems;
                              } else {
                                showToast(`Producto agregado: ${prod.name}`, 'success');
                                return [...prev, {
                                  product_id: prod.id,
                                  product_name: prod.name,
                                  cost_price: estimatedCost,
                                  quantity: 1
                                }];
                              }
                            });
                            playBeep('success');
                            setPurchaseBarcode('');
                          }
                        }
                      }}
                      style={{
                        width: '100%', padding: '0.5rem 0.8rem', background: 'var(--bg)',
                        border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', outline: 'none', fontSize: '0.82rem', fontFamily: 'monospace'
                      }}
                    />
                  </div>

                  {/* Select Product */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Producto Existente</label>
                    <select
                      value={selectedProductId}
                      onChange={e => {
                        setSelectedProductId(e.target.value);
                        // pre-fill cost if product is selected
                        const p = products.find(prod => prod.id === parseInt(e.target.value, 10));
                        if (p) setItemCost(String((p.price * 0.7).toFixed(2))); // estimate cost price as 70% of retail
                      }}
                      style={{
                        width: '100%', padding: '0.5rem 0.8rem', background: 'var(--bg)',
                        border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', outline: 'none', fontSize: '0.82rem', cursor: 'pointer'
                      }}
                    >
                      <option value="" disabled>Seleccione el producto...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem', alignItems: 'end' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Cantidad (uds)</label>
                      <input
                        type="number"
                        min="1"
                        value={itemQuantity}
                        onChange={e => setItemQuantity(e.target.value)}
                        style={{
                          width: '100%', padding: '0.5rem 0.8rem', background: 'var(--bg)',
                          border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', outline: 'none', fontSize: '0.82rem'
                        }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Costo Compra ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={itemCost}
                        onChange={e => setItemCost(e.target.value)}
                        style={{
                          width: '100%', padding: '0.5rem 0.8rem', background: 'var(--bg)',
                          border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', outline: 'none', fontSize: '0.82rem'
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddToOrderCart}
                      style={{
                        padding: '0.5rem', background: 'rgba(212,175,55,0.1)', color: 'var(--gold)',
                        border: '1px solid var(--gold)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem',
                        fontWeight: 700, minHeight: '34px'
                      }}
                    >
                      ✓ Añadir
                    </button>
                  </div>

                  {/* Or pre-register a new product */}
                  <div style={{ textAlign: 'center', marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px dashed var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => setIsPreRegOpen(true)}
                      style={{
                        background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer',
                        fontSize: '0.78rem', textDecoration: 'underline', fontWeight: 600
                      }}
                    >
                      ✨ ¿El producto es nuevo? Registrar por adelantado
                    </button>
                  </div>
                </div>
              </div>

              {/* Order Cart list */}
              <div>
                <h4 style={{ fontSize: '0.85rem', marginBottom: '0.6rem' }}>🛒 Detalle de ítems agregados:</h4>
                {cartItems.length === 0 ? (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem', background: 'var(--bg3)', borderRadius: '8px' }}>
                    Aún no hay productos en esta compra.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                    {cartItems.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px',
                          padding: '0.6rem 0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}
                      >
                        <div style={{ flex: 2 }}>
                          <strong>{item.product_name}</strong>
                          {item.product_id === null && (
                            <span style={{ fontSize: '0.65rem', padding: '1px 4px', borderRadius: '4px', background: 'rgba(52,152,219,0.15)', color: '#3498DB', marginLeft: '0.4rem' }}>
                              Nuevo Pre-registro
                            </span>
                          )}
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            {item.product_id === null && `Venta: $${item.retail_price} | `} Costo Unit: ${item.cost_price}
                          </div>
                        </div>

                        <div style={{ flex: 1, display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={e => handleUpdateCartQty(idx, e.target.value)}
                            style={{
                              width: '55px', padding: '3px', background: 'var(--bg)',
                              border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text)', fontSize: '0.78rem', textAlign: 'center'
                            }}
                          />
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>uds</span>
                        </div>

                        <div style={{ flex: 1, textAlign: 'right', fontWeight: 'bold', fontSize: '0.88rem' }}>
                          ${(item.cost_price * item.quantity).toFixed(2)}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveFromCart(idx)}
                          style={{
                            background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer',
                            padding: '0 0.5rem', fontSize: '1rem'
                          }}
                          title="Eliminar de la compra"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.8rem 0.5rem 0 0.5rem', fontSize: '0.9rem', borderTop: '1px solid var(--border)' }}>
                      <strong>Costo Total Compra:</strong>
                      <strong style={{ color: 'var(--gold)' }}>
                        ${cartItems.reduce((sum, item) => sum + (item.cost_price * item.quantity), 0).toFixed(2)}
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Notas adicionales / Comentario</label>
                <textarea
                  placeholder="E.g. Compra para reposición por agotado, cargamento Mercado Libre, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  style={{
                    width: '100%', padding: '0.6rem 0.8rem', background: 'var(--bg3)', resize: 'vertical',
                    border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', outline: 'none', fontSize: '0.88rem'
                  }}
                />
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  style={{
                    flex: 1, padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                    borderRadius: '8px', color: 'var(--text)', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    flex: 1, padding: '0.75rem', background: 'var(--gold)', border: 'none',
                    borderRadius: '8px', color: '#000', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 700,
                    opacity: saving ? 0.7 : 1, justifyContent: 'center'
                  }}
                >
                  {saving ? 'Registrando...' : '💾 Registrar Compra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Flotante: Pre-registrar Producto Nuevo ── */}
      {isPreRegOpen && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '1rem'
          }}
          onClick={() => setIsPreRegOpen(false)}
        >
          <div
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              width: '100%',
              maxWidth: '450px',
              padding: '1.5rem',
              boxShadow: 'var(--shadow)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.8rem', marginBottom: '1.2rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--gold)' }}>
                ✨ Registrar Producto por Adelantado
              </h3>
              <button onClick={() => setIsPreRegOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Nombre del Producto *</label>
                <input
                  type="text"
                  placeholder="E.g. Audífonos Bluetooth Pro Max"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  style={{
                    width: '100%', padding: '0.6rem 0.8rem', background: 'var(--bg3)',
                    border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', outline: 'none', fontSize: '0.88rem'
                  }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Categoría</label>
                <select
                  value={newProdCatId}
                  onChange={e => setNewProdCatId(e.target.value)}
                  style={{
                    width: '100%', padding: '0.6rem 0.8rem', background: 'var(--bg3)',
                    border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', outline: 'none', fontSize: '0.88rem', cursor: 'pointer'
                  }}
                >
                  <option value="">Sin categoría...</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Costo Compra ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={newProdCost}
                    onChange={(e) => setNewProdCost(e.target.value)}
                    style={{
                      width: '100%', padding: '0.6rem 0.8rem', background: 'var(--bg3)',
                      border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', outline: 'none', fontSize: '0.88rem'
                    }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Precio Venta ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={newProdRetail}
                    onChange={(e) => setNewProdRetail(e.target.value)}
                    style={{
                      width: '100%', padding: '0.6rem 0.8rem', background: 'var(--bg3)',
                      border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', outline: 'none', fontSize: '0.88rem'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsPreRegOpen(false)}
                  style={{
                    flex: 1, padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                    borderRadius: '8px', color: 'var(--text)', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAddPreRegToCart}
                  style={{
                    flex: 1, padding: '0.75rem', background: 'var(--gold)', border: 'none',
                    borderRadius: '8px', color: '#000', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 700
                  }}
                >
                  ✓ Confirmar e Incorporar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
