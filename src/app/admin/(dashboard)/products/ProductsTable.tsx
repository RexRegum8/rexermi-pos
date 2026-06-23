'use client';
import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import AdminProductActions from './AdminProductActions';
import Barcode39 from '@/components/Barcode39';
import { useToast } from '@/context/ToastContext';

interface Product {
  id: number; name: string; slug: string; price: number;
  stock: number; type: string; is_active: number; is_featured: number;
  cat_name: string | null; image: string | null; views: number;
  es_subproducto?: number; id_producto_padre?: number | null;
  unidades_por_padre?: number | null; parent_name?: string | null;
  parent_stock?: number | null;
  supplier_id?: number | null;
  supplier_name?: string | null;
  purchase_url?: string | null;
  min_stock_alert?: number | null;
  barcode?: string | null;
}

function generateBarcodeSVGString(value: string, width = 0.8, height = 22) {
  const CODE39_ENCODINGS: Record<string, string> = {
    '0': 'NNNWWNWNN', '1': 'WNNWNNNNW', '2': 'NNWWNNNNW', '3': 'WNWWNNNNN',
    '4': 'NNNWWNNNW', '5': 'WNNWWNNNN', '6': 'NNWWWWNNN', '7': 'NNNWNNWNW',
    '8': 'WNNWNNWNN', '9': 'NNWWNNWNN', 'A': 'WNNNNWNNW', 'B': 'NNWNNWNNW',
    'C': 'WNWNNWNNN', 'D': 'NNNNWWNNW', 'E': 'WNNNWWNNN', 'F': 'NNWNWWNNN',
    'G': 'NNNNNWWNW', 'H': 'WNNNNWWNN', 'I': 'NNWNNWWNN', 'J': 'NNNNWWWNN',
    'K': 'WNNNNNNWW', 'L': 'NNWNNNNWW', 'M': 'WNWNNNNWN', 'N': 'NNNNWNNWW',
    'O': 'WNNNWNNWN', 'P': 'NNWNWNNWN', 'Q': 'NNNNNNWWW', 'R': 'WNNNNNWWN',
    'S': 'NNWNNNWWN', 'T': 'NNNNWNWWN', 'U': 'WWNNNNNNW', 'V': 'NWWNNNNNW',
    'W': 'WWWNNNNNN', 'X': 'NWNNWNNNW', 'Y': 'WWNNWNNNN', 'Z': 'NWWNWNNNN',
    '-': 'NWNNNNWNW', '.': 'WWNNNNWNN', ' ': 'NWWNNNWWN', '*': 'NWNNWNWNN',
    '$': 'NWNWNWNNN', '/': 'NWNWNNNWN', '+': 'NWNNNWNWN', '%': 'NNNWNWNWN'
  };

  const rawText = String(value || '').toUpperCase();
  const filteredText = rawText.split('').filter(char => CODE39_ENCODINGS[char]).join('');
  if (!filteredText) return '';

  const textToEncode = `*${filteredText}*`;
  let currentX = 0;
  const narrow = width;
  const wide = width * 3;
  const gap = width;

  let rectsHtml = '';
  for (let i = 0; i < textToEncode.length; i++) {
    const char = textToEncode[i];
    const pattern = CODE39_ENCODINGS[char];
    if (!pattern) continue;

    for (let j = 0; j < 9; j++) {
      const type = pattern[j];
      const isBar = j % 2 === 0;
      const w = type === 'W' ? wide : narrow;

      if (isBar) {
        rectsHtml += `<rect x="${currentX}" y="0" width="${w}" height="${height}" fill="#000" />`;
      }
      currentX += w;
    }
    currentX += gap;
  }

  return `<svg width="${currentX}" height="${height}" viewBox="0 0 ${currentX} ${height}">${rectsHtml}</svg>`;
}

export default function ProductsTable({ 
  initialProducts, 
  categoriesList = [],
  totalPages,
  currentPage,
  totalItems 
}: { 
  initialProducts: Product[], 
  categoriesList: string[],
  totalPages: number,
  currentPage: number,
  totalItems: number 
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { showToast } = useToast();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Local state for smooth typing
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [activeFilter, setActiveFilter] = useState(searchParams.get('filter') || '');

  // Batch actions states
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchPriceValue, setBatchPriceValue] = useState('');
  const [batchPriceType, setBatchPriceType] = useState<'flat' | 'percentage'>('percentage');
  const [batchPriceDirection, setBatchPriceDirection] = useState<'increase' | 'decrease'>('increase');
  const [batchUpdating, setBatchUpdating] = useState(false);

  const [costHistory, setCostHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [productsToPrint, setProductsToPrint] = useState<{ id: number; name: string; barcode: string; price: number; quantity: number }[]>([]);
  const [templateType, setTemplateType] = useState<'thermal' | 'sheet'>('thermal');
  const [includePrice, setIncludePrice] = useState(false);

  const updateURL = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, val]) => {
      if (val === null || val === '') {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    });
    router.push(`${pathname}?${params.toString()}`);
  };

  // Debounce search input to avoid hitting database on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentSearch = searchParams.get('search') || '';
      if (searchQuery.trim() !== currentSearch.trim()) {
        updateURL({ search: searchQuery.trim(), page: '1' });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleCategoryChange = (val: string) => {
    setSelectedCategory(val);
    updateURL({ category: val, page: '1' });
  };

  const handleFilterChange = (val: string) => {
    setActiveFilter(val);
    updateURL({ filter: val, page: '1' });
  };

  const handlePageChange = (newPage: number) => {
    updateURL({ page: String(newPage) });
  };

  useEffect(() => {
    if (selectedProduct) {
      setLoadingHistory(true);
      fetch(`/api/admin/products/${selectedProduct.id}/cost-history`)
        .then(res => res.json() as any)
        .then(data => {
          if (data.success) {
            setCostHistory(data.history || []);
          }
        })
        .catch(err => console.error('Error fetching cost history:', err))
        .finally(() => setLoadingHistory(false));
    } else {
      setCostHistory([]);
    }
  }, [selectedProduct]);

  useEffect(() => {
    setSelectedIds([]);
  }, [initialProducts]);

  const handleBatchPriceUpdate = async () => {
    const value = parseFloat(batchPriceValue);
    if (isNaN(value) || value < 0) {
      showToast('Por favor introduce un valor numérico válido.', 'error');
      return;
    }
    setBatchUpdating(true);
    try {
      const res = await fetch('/api/admin/products/batch-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: selectedIds,
          type: batchPriceType,
          value,
          direction: batchPriceDirection
        })
      });
      const data = (await res.json()) as any;
      if (data.success) {
        showToast(`✅ Se actualizaron los precios de ${data.updatedCount} productos correctamente.`, 'success');
        setSelectedIds([]);
        setIsBatchModalOpen(false);
        setBatchPriceValue('');
        router.refresh();
      } else {
        showToast(data.error || 'Error al actualizar precios.', 'error');
      }
    } catch {
      showToast('Error de red al realizar actualización masiva.', 'error');
    } finally {
      setBatchUpdating(false);
    }
  };

  const filteredProducts = initialProducts;

  return (
    <>
      {activeFilter === 'low-stock' && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(231, 76, 60, 0.1)',
          border: '1px solid rgba(231, 76, 60, 0.3)',
          borderRadius: '10px',
          padding: '0.8rem 1.2rem',
          marginBottom: '1.2rem',
          fontSize: '0.88rem',
          color: '#e74c3c',
          animation: 'fadeInDown 0.3s ease'
        }}>
          <span>⚠️ Mostrando únicamente productos con <strong>Stock Crítico (≤ Alerta Mínima configurada)</strong>.</span>
          <button
            onClick={() => handleFilterChange('')}
            style={{
              background: 'var(--border)',
              border: 'none',
              borderRadius: '6px',
              color: 'var(--text)',
              padding: '0.35rem 0.8rem',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
              transition: 'background-color 0.2s'
            }}
          >
            Quitar Filtro
          </button>
        </div>
      )}

      {activeFilter === 'pending' && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(241, 196, 15, 0.1)',
          border: '1px solid rgba(241, 196, 15, 0.3)',
          borderRadius: '10px',
          padding: '0.8rem 1.2rem',
          marginBottom: '1.2rem',
          fontSize: '0.88rem',
          color: '#F1C40F',
          animation: 'fadeInDown 0.3s ease'
        }}>
          <span>⏳ Mostrando productos en lista de espera <strong>Por Completar</strong> (no visibles en la tienda ni POS).</span>
          <button
            onClick={() => handleFilterChange('')}
            style={{
              background: 'var(--border)',
              border: 'none',
              borderRadius: '6px',
              color: 'var(--text)',
              padding: '0.35rem 0.8rem',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
              transition: 'background-color 0.2s'
            }}
          >
            Quitar Filtro
          </button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.8rem', flex: 1, maxWidth: '750px', flexWrap: 'wrap' }}>
          <div className="search-bar" style={{ flex: 2, minWidth: '200px', margin: 0 }}>
            <input
              type="text"
              placeholder="🔍 Buscar producto por nombre, categoría o ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            value={selectedCategory}
            onChange={e => handleCategoryChange(e.target.value)}
            style={{
              flex: 1,
              minWidth: '150px',
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '0.7rem 0.9rem',
              color: 'var(--text)',
              fontSize: '0.88rem',
              outline: 'none',
              minHeight: '44px',
              cursor: 'pointer'
            }}
          >
            <option value="">Todas las Categorías</option>
            <option value="Sin categoría">Sin categoría</option>
            {categoriesList.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            value={activeFilter}
            onChange={e => handleFilterChange(e.target.value)}
            style={{
              flex: 1,
              minWidth: '150px',
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '0.7rem 0.9rem',
              color: 'var(--text)',
              fontSize: '0.88rem',
              outline: 'none',
              minHeight: '44px',
              cursor: 'pointer'
            }}
          >
            <option value="">Todos los Estados</option>
            <option value="active">🟢 Activos</option>
            <option value="inactive">🔴 Inactivos</option>
            <option value="pending">⏳ Por Completar</option>
            <option value="low-stock">⚠️ Stock Crítico</option>
          </select>
        </div>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {totalItems} productos encontrados
        </span>
      </div>

      {/* Desktop Table View */}
      <div className="desktop-only table-card">
        <table>
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={filteredProducts.length > 0 && selectedIds.length === filteredProducts.length}
                  ref={el => {
                    if (el) {
                      el.indeterminate = selectedIds.length > 0 && selectedIds.length < filteredProducts.length;
                    }
                  }}
                  onChange={() => {
                    if (selectedIds.length === filteredProducts.length) {
                      setSelectedIds([]);
                    } else {
                      setSelectedIds(filteredProducts.map(p => p.id));
                    }
                  }}
                  style={{ cursor: 'pointer', transform: 'scale(1.15)', accentColor: 'var(--gold)' }}
                />
              </th>
              <th>Imagen</th><th>Nombre</th><th>Categoría</th><th>Precio</th>
              <th>Stock</th><th>Tipo</th><th>Estado</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map(p => (
              <tr key={p.id}>
                <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(p.id)}
                    onChange={() => {
                      setSelectedIds(prev =>
                        prev.includes(p.id)
                          ? prev.filter(id => id !== p.id)
                          : [...prev, p.id]
                      );
                    }}
                    style={{ cursor: 'pointer', transform: 'scale(1.15)', accentColor: 'var(--gold)' }}
                  />
                </td>
                <td>
                  {p.image ? (
                    <div style={{ position: 'relative', width: '44px', height: '44px', borderRadius: '6px', overflow: 'hidden', background: 'var(--bg3)', flexShrink: 0 }}>
                      <Image src={`/api/assets/uploads/${p.image}`} alt={p.name} fill sizes="44px" style={{ objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div style={{ width: '44px', height: '44px', background: 'var(--bg3)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📦</div>
                  )}
                </td>
                <td className="allow-wrap">
                  <strong style={{ fontSize: '0.88rem' }}>{p.name}</strong>
                  {p.is_featured ? <span className="badge-featured" style={{ marginLeft: '0.4rem' }}>★</span> : null}
                  {p.barcode ? <span title={`Código: ${p.barcode}`} style={{ marginLeft: '0.4rem', fontSize: '0.7rem', background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', padding: '1px 5px', borderRadius: '4px', fontFamily: 'monospace', verticalAlign: 'middle' }}>📊</span> : null}
                </td>
                <td style={{ color: 'var(--text-muted)' }}>{p.cat_name || '—'}</td>
                <td style={{ color: 'var(--gold)', fontWeight: 700 }}>${Number(p.price).toFixed(2)}</td>
                <td>
                  {p.type === 'service' ? (
                    <span>∞</span>
                  ) : (
                    <div>
                      <span style={{ 
                        color: p.stock <= (p.min_stock_alert !== undefined && p.min_stock_alert !== null ? p.min_stock_alert : 3) ? 'var(--error)' : 'inherit', 
                        fontWeight: p.stock <= (p.min_stock_alert !== undefined && p.min_stock_alert !== null ? p.min_stock_alert : 3) ? 700 : 400 
                      }}>
                        {p.stock}
                      </span>
                      {p.es_subproducto === 1 && p.id_producto_padre !== null && p.unidades_por_padre && p.unidades_por_padre > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                          <span>Virtual: {p.stock + (p.parent_stock || 0) * p.unidades_por_padre}</span>
                          <span style={{ color: 'var(--gold)', fontSize: '0.7rem' }}>
                            (Hijo de: {p.parent_name || `ID ${p.id_producto_padre}`})
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </td>
                <td>
                  <span className={p.type === 'service' ? 'badge-service' : 'badge-featured'}>
                    {p.type === 'service' ? 'Servicio' : 'Producto'}
                  </span>
                </td>
                <td>
                  <span className={`status-badge ${p.is_active === 1 ? 'status-paid' : p.is_active === 2 ? 'status-pending' : 'status-cancelled'}`}>
                    {p.is_active === 1 ? 'Activo' : p.is_active === 2 ? 'Por completar' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <AdminProductActions id={p.id} isActive={!!p.is_active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards Grid View */}
      <div className="mobile-only mobile-card-grid">
        {filteredProducts.map(p => {
          const virtualStock = p.es_subproducto === 1 && p.id_producto_padre !== null && p.unidades_por_padre && p.unidades_por_padre > 0
            ? p.stock + (p.parent_stock || 0) * p.unidades_por_padre
            : null;

          return (
            <div key={p.id} className="mobile-data-card" onClick={() => setSelectedProduct(p)} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              {p.image ? (
                <div style={{ position: 'relative', width: '56px', height: '56px', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg3)', flexShrink: 0 }}>
                  <Image src={`/api/assets/uploads/${p.image}`} alt={p.name} fill sizes="56px" style={{ objectFit: 'cover' }} />
                </div>
              ) : (
                <div style={{ width: '56px', height: '56px', background: 'var(--bg3)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>📦</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</strong>
                  <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '0.85rem' }}>${Number(p.price).toFixed(2)}</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{p.cat_name || 'Sin categoría'}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.6rem', fontSize: '0.78rem' }}>
                  <span style={{
                    color: p.type === 'product' && p.stock <= (p.min_stock_alert !== undefined && p.min_stock_alert !== null ? p.min_stock_alert : 3) ? 'var(--error)' : 'inherit',
                    fontWeight: p.type === 'product' && p.stock <= (p.min_stock_alert !== undefined && p.min_stock_alert !== null ? p.min_stock_alert : 3) ? 700 : 400
                  }}>
                    Stock: {p.type === 'service' ? '∞' : p.stock}
                    {virtualStock !== null && <span style={{ color: 'var(--gold)' }}> (Virtual: {virtualStock})</span>}
                  </span>
                  <span className={`status-badge ${p.is_active === 1 ? 'status-paid' : p.is_active === 2 ? 'status-pending' : 'status-cancelled'}`} style={{ transform: 'scale(0.85)', transformOrigin: 'right center' }}>
                    {p.is_active === 1 ? 'Activo' : p.is_active === 2 ? 'Por completar' : 'Inactivo'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem', marginBottom: '2rem' }}>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="btn-outline"
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              opacity: currentPage === 1 ? 0.4 : 1,
              borderRadius: '8px',
              minHeight: '38px',
            }}
          >
            ◀ Anterior
          </button>
          <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Página <span style={{ color: 'var(--gold)' }}>{currentPage}</span> de {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="btn-outline"
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              opacity: currentPage === totalPages ? 0.4 : 1,
              borderRadius: '8px',
              minHeight: '38px',
            }}
          >
            Siguiente ▶
          </button>
        </div>
      )}

      {/* Product Detail Drawer */}
      {selectedProduct && (
        <div className="drawer-backdrop" onClick={() => setSelectedProduct(null)}>
          <div className="drawer-content" onClick={e => e.stopPropagation()}>
            <div className="drawer-handle" />
            <button className="drawer-close-btn" onClick={() => setSelectedProduct(null)}>✕</button>
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.2rem', fontWeight: 700, color: 'var(--gold)' }}>📦 Detalle del Producto</h3>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
              {selectedProduct.image ? (
                <div style={{ position: 'relative', width: '70px', height: '70px', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg3)', flexShrink: 0 }}>
                  <Image src={`/api/assets/uploads/${selectedProduct.image}`} alt={selectedProduct.name} fill sizes="70px" style={{ objectFit: 'cover' }} />
                </div>
              ) : (
                <div style={{ width: '70px', height: '70px', background: 'var(--bg3)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>📦</div>
              )}
              <div>
                <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text)' }}>{selectedProduct.name}</h4>
                <div style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '1rem', marginTop: '0.2rem' }}>${Number(selectedProduct.price).toFixed(2)}</div>
              </div>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Categoría</span>
              <span className="drawer-detail-value">{selectedProduct.cat_name || '—'}</span>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Tipo de Item</span>
              <span className="drawer-detail-value">
                <span className={selectedProduct.type === 'service' ? 'badge-service' : 'badge-featured'}>
                  {selectedProduct.type === 'service' ? 'Servicio' : 'Producto'}
                </span>
              </span>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Stock Físico</span>
              <span className="drawer-detail-value">{selectedProduct.type === 'service' ? 'Ilimitado (∞)' : selectedProduct.stock}</span>
            </div>

            {selectedProduct.type === 'product' && (
              <div className="drawer-detail-row">
                <span className="drawer-detail-label">Alerta de Stock Crítico</span>
                <span className="drawer-detail-value" style={{ color: 'var(--error)', fontWeight: 600 }}>
                  {selectedProduct.min_stock_alert !== undefined && selectedProduct.min_stock_alert !== null ? selectedProduct.min_stock_alert : 3} unidades
                </span>
              </div>
            )}

            {selectedProduct.es_subproducto === 1 && selectedProduct.id_producto_padre !== null && selectedProduct.unidades_por_padre && selectedProduct.unidades_por_padre > 0 && (
              <>
                <div className="drawer-detail-row">
                  <span className="drawer-detail-label">Stock Virtual Relacionado</span>
                  <span className="drawer-detail-value" style={{ color: 'var(--gold)', fontWeight: 700 }}>
                    {selectedProduct.stock + (selectedProduct.parent_stock || 0) * selectedProduct.unidades_por_padre} unidades
                  </span>
                </div>
                <div className="drawer-detail-row">
                  <span className="drawer-detail-label">Producto Padre</span>
                  <span className="drawer-detail-value">
                    {selectedProduct.parent_name || `ID ${selectedProduct.id_producto_padre}`} ({selectedProduct.parent_stock} cajas en stock)
                  </span>
                </div>
                <div className="drawer-detail-row">
                  <span className="drawer-detail-label">Rendimiento por Padre</span>
                  <span className="drawer-detail-value">{selectedProduct.unidades_por_padre} unidades por caja</span>
                </div>
              </>
            )}

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Estado de Visibilidad</span>
              <span className="drawer-detail-value">
                <span className={`status-badge ${selectedProduct.is_active === 1 ? 'status-paid' : selectedProduct.is_active === 2 ? 'status-pending' : 'status-cancelled'}`}>
                  {selectedProduct.is_active === 1 ? 'Activo' : selectedProduct.is_active === 2 ? 'Por completar' : 'Inactivo'}
                </span>
              </span>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">📊 Código de Barras</span>
              <span className="drawer-detail-value" style={{ fontFamily: 'monospace', letterSpacing: '0.05em', fontWeight: 600 }}>
                {selectedProduct.barcode || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontWeight: 400, fontFamily: 'inherit' }}>Sin asignar</span>}
              </span>
            </div>

            {selectedProduct.barcode && (
              <div style={{ marginTop: '0.4rem', display: 'flex', justifyContent: 'flex-end', marginBottom: '0.6rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setProductsToPrint([{
                      id: selectedProduct.id,
                      name: selectedProduct.name,
                      barcode: selectedProduct.barcode || '',
                      price: selectedProduct.price,
                      quantity: 1
                    }]);
                    setTemplateType('thermal');
                    setIncludePrice(false);
                    setIsLabelModalOpen(true);
                  }}
                  className="btn-outline"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontSize: '0.78rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  🖨️ Imprimir Etiqueta
                </button>
              </div>
            )}

            {selectedProduct.supplier_name && (
              <div className="drawer-detail-row">
                <span className="drawer-detail-label">Proveedor Habitual</span>
                <span className="drawer-detail-value" style={{ fontWeight: 600 }}>{selectedProduct.supplier_name}</span>
              </div>
            )}

            {selectedProduct.purchase_url && (
              <div style={{ marginTop: '0.8rem' }}>
                <a
                  href={selectedProduct.purchase_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    fontSize: '0.82rem',
                    padding: '0.5rem',
                    textDecoration: 'none',
                    borderRadius: '8px',
                    borderColor: 'var(--gold)',
                    color: 'var(--gold)',
                    textAlign: 'center'
                  }}
                >
                  🌐 Ir al Enlace del Proveedor
                </a>
              </div>
            )}

            {selectedProduct.type === 'product' && selectedProduct.stock <= 3 && selectedProduct.supplier_id && (
              <div style={{ marginTop: '0.8rem' }}>
                <Link
                  href={`/admin/purchases?reorder_product_id=${selectedProduct.id}&supplier_id=${selectedProduct.supplier_id}&qty=10`}
                  className="btn-primary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    fontSize: '0.82rem',
                    padding: '0.5rem 1rem',
                    fontWeight: 700,
                    textDecoration: 'none',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #e67e22 0%, #d35400 100%)',
                    color: '#fff',
                    border: 'none',
                    textAlign: 'center'
                  }}
                >
                  📥 Reordenar Stock (10 uds)
                </Link>
              </div>
            )}

            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.2rem' }}>
              <span className="drawer-detail-label" style={{ marginBottom: '0.6rem', display: 'block', fontWeight: 600 }}>📈 Historial de Costos de Compra</span>
              {loadingHistory ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cargando historial...</p>
              ) : costHistory.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin compras previas registradas.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
                  {costHistory.map((item, idx) => (
                    <div key={idx} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.5rem 0.8rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                      <div>
                        <strong style={{ color: 'var(--gold)' }}>${Number(item.cost_price).toFixed(2)}</strong>
                        <span style={{ color: 'var(--text-muted)', marginLeft: '0.4rem' }}>({item.quantity} uds)</span>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Prov: {item.supplier_name || 'Desconocido'}</div>
                      </div>
                      <div style={{ color: 'var(--text-muted)', textAlign: 'right' }}>
                        {item.received_at ? new Date(item.received_at).toLocaleDateString() : new Date(item.created_at).toLocaleDateString()}
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>OC #{item.purchase_order_id}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: '1.8rem', paddingTop: '1.2rem', borderTop: '1px solid var(--border)' }}>
              <span className="drawer-detail-label" style={{ marginBottom: '0.6rem', display: 'block' }}>Acciones Administrativas</span>
              <div onClick={e => e.stopPropagation()}>
                <AdminProductActions id={selectedProduct.id} isActive={!!selectedProduct.is_active} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Label Printing Modal */}
      {isLabelModalOpen && productsToPrint.length > 0 && (
        <div
          className="modal-overlay open"
          style={{ zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setIsLabelModalOpen(false)}
        >
          <div
            className="modal"
            style={{ maxWidth: '850px', width: '90%', color: 'var(--text)', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', boxShadow: 'var(--shadow)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.6rem', marginBottom: '1.2rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🖨️ Impresor de Etiquetas
              </h3>
              <button
                type="button"
                onClick={() => setIsLabelModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.25rem', cursor: 'pointer', outline: 'none' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', maxHeight: '70vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {/* Left Column: Form & Product List */}
              <div style={{ flex: '1 1 450px', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                {/* 1. Layout Selection */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                      Formato de Impresión
                    </label>
                    <select
                      value={templateType}
                      onChange={(e) => setTemplateType(e.target.value as 'thermal' | 'sheet')}
                      style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.6rem 0.8rem', color: 'var(--text)', fontSize: '0.88rem', outline: 'none', cursor: 'pointer' }}
                    >
                      <option value="thermal">🏷️ Ticket Térmico (50x25mm)</option>
                      <option value="sheet">📄 Hoja Carta (30 etiquetas - 3x10)</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.4rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={includePrice}
                        onChange={(e) => setIncludePrice(e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--gold)' }}
                      />
                      <span>Incluir precio en etiqueta</span>
                    </label>
                  </div>
                </div>

                {/* 2. Product Items List */}
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.6rem' }}>
                    Selección y Cantidades
                  </label>
                  <div style={{
                    maxHeight: '220px',
                    overflowY: 'auto',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    background: 'var(--bg3)'
                  }}>
                    {productsToPrint.map((prod, idx) => (
                      <div
                        key={prod.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.6rem 0.8rem',
                          borderBottom: idx === productsToPrint.length - 1 ? 'none' : '1px solid var(--border)',
                          fontSize: '0.82rem',
                          opacity: prod.barcode ? 1 : 0.6
                        }}
                      >
                        <div style={{ flex: 1, paddingRight: '0.8rem' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px' }}>
                            {prod.name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                            {prod.barcode ? `Código: ${prod.barcode}` : '⚠️ Sin código de barra'}
                          </div>
                        </div>

                        {prod.barcode ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setProductsToPrint(prev => prev.map(p => p.id === prod.id ? { ...p, quantity: Math.max(0, p.quantity - 1) } : p));
                              }}
                              style={{ width: '24px', height: '24px', borderRadius: '4px', background: 'var(--border)', border: 'none', color: 'var(--text)', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              max="200"
                              value={prod.quantity}
                              onChange={(e) => {
                                const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                setProductsToPrint(prev => prev.map(p => p.id === prod.id ? { ...p, quantity: val } : p));
                              }}
                              style={{ width: '45px', textAlign: 'center', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 4px', color: 'var(--text)', fontSize: '0.8rem' }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setProductsToPrint(prev => prev.map(p => p.id === prod.id ? { ...p, quantity: p.quantity + 1 } : p));
                              }}
                              style={{ width: '24px', height: '24px', borderRadius: '4px', background: 'var(--border)', border: 'none', color: 'var(--text)', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'var(--error)', fontStyle: 'italic' }}>
                            No imprimible
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4', background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: '8px', padding: '0.6rem 0.8rem' }}>
                  💡 <strong>Consejo para insumos / hojas sueltas:</strong> No necesitas etiquetar cada hoja individual. Imprime 1 etiqueta para la resma ("Rema de Hojas") y coloca otra etiqueta en la bandeja o contenedor de hojas sueltas para escanearla directo al vender.
                </div>
              </div>

              {/* Right Column: Live Preview */}
              <div style={{ flex: '1 1 250px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg3)', borderRadius: '10px', padding: '1.5rem', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '1rem', display: 'block', alignSelf: 'flex-start' }}>
                  VISTA PREVIA
                </span>

                {productsToPrint.find(p => p.barcode && p.quantity > 0) ? (() => {
                  const previewProd = productsToPrint.find(p => p.barcode && p.quantity > 0)!;
                  return (
                    <div style={{ border: '1px dashed var(--border)', borderRadius: '8px', padding: '1rem', background: '#f8fafc', display: 'flex', justifyContent: 'center', width: '100%', maxWidth: '280px' }}>
                      <div
                        style={{
                          width: '50mm',
                          height: '25mm',
                          background: '#fff',
                          color: '#000',
                          border: '1px solid #ddd',
                          padding: '2mm',
                          boxSizing: 'border-box',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontFamily: 'system-ui, sans-serif'
                        }}
                      >
                        <div style={{ fontSize: '7pt', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#000', lineHeight: 1 }}>
                          REXERMI
                        </div>
                        <div style={{ fontSize: '6pt', fontWeight: 600, color: '#333', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '46mm', lineHeight: 1.1 }}>
                          {previewProd.name}
                        </div>
                        <div style={{ transform: 'scale(0.85)', transformOrigin: 'center center' }}>
                          <Barcode39 value={previewProd.barcode} width={0.8} height={22} />
                        </div>
                        <div style={{ fontSize: '8pt', fontWeight: 800, color: '#000', lineHeight: 1, minHeight: '8pt' }}>
                          {includePrice ? `$${Number(previewProd.price).toFixed(2)}` : ''}
                        </div>
                      </div>
                    </div>
                  );
                })() : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic', textAlign: 'center' }}>
                    Agrega cantidad a algún producto con código para ver vista previa
                  </div>
                )}

                <div style={{ marginTop: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  Total a imprimir:{' '}
                  <strong style={{ color: 'var(--gold)' }}>
                    {productsToPrint.reduce((acc, p) => acc + (p.barcode ? p.quantity : 0), 0)}
                  </strong>{' '}
                  etiquetas
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.8rem' }}>
              <button type="button" className="btn-outline" onClick={() => setIsLabelModalOpen(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={productsToPrint.reduce((acc, p) => acc + (p.barcode ? p.quantity : 0), 0) === 0}
                onClick={() => {
                  const printableItems: { name: string; barcode: string; price: number }[] = [];
                  productsToPrint.forEach(prod => {
                    if (prod.barcode && prod.quantity > 0) {
                      for (let q = 0; q < prod.quantity; q++) {
                        printableItems.push({
                          name: prod.name,
                          barcode: prod.barcode,
                          price: prod.price
                        });
                      }
                    }
                  });

                  if (printableItems.length === 0) return;

                  const printWindow = window.open('', '_blank');
                  if (printWindow) {
                    let styleTag = '';
                    let bodyHtml = '';

                    if (templateType === 'thermal') {
                      styleTag = `
                        @page {
                          size: 50mm 25mm;
                          margin: 0;
                        }
                        body {
                          margin: 0;
                          padding: 0;
                          background: #fff;
                          -webkit-print-color-adjust: exact;
                        }
                        .label-container {
                          width: 50mm;
                          height: 25mm;
                          padding: 2mm 3mm;
                          box-sizing: border-box;
                          display: flex;
                          flex-direction: column;
                          justify-content: space-between;
                          align-items: center;
                          page-break-after: always;
                          font-family: system-ui, sans-serif;
                        }
                        .title {
                          font-size: 7pt;
                          font-weight: 800;
                          letter-spacing: 0.1em;
                          text-transform: uppercase;
                          line-height: 1;
                          margin-bottom: 1px;
                        }
                        .name {
                          font-size: 6.5pt;
                          font-weight: 600;
                          text-align: center;
                          white-space: nowrap;
                          overflow: hidden;
                          text-overflow: ellipsis;
                          width: 44mm;
                          line-height: 1.1;
                        }
                        .barcode-box {
                          display: flex;
                          flex-direction: column;
                          align-items: center;
                          margin: 1px 0;
                        }
                        .barcode-svg {
                          height: 25px;
                        }
                        .barcode-text {
                          font-size: 5pt;
                          font-family: monospace;
                          letter-spacing: 0.1em;
                          margin-top: 1px;
                          font-weight: bold;
                        }
                        .price {
                          font-size: 8.5pt;
                          font-weight: 800;
                          line-height: 1;
                        }
                      `;

                      bodyHtml = printableItems.map(item => `
                        <div class="label-container">
                          <div class="title">REXERMI</div>
                          <div class="name">${item.name}</div>
                          <div class="barcode-box">
                            ${generateBarcodeSVGString(item.barcode, 0.8, 22)}
                            <div class="barcode-text">${item.barcode}</div>
                          </div>
                          <div class="price">${includePrice ? `$${Number(item.price).toFixed(2)}` : ''}</div>
                        </div>
                      `).join('');
                    } else {
                      // Hojas Carta 3x10 (Avery 5160)
                      styleTag = `
                        @page {
                          size: letter;
                          margin: 0;
                        }
                        body {
                          margin: 0;
                          padding: 0;
                          background: #fff;
                          -webkit-print-color-adjust: exact;
                        }
                        .sheet-page {
                          width: 215.9mm;
                          height: 279.4mm;
                          padding: 12.7mm 5.58mm;
                          box-sizing: border-box;
                          page-break-after: always;
                          display: grid;
                          grid-template-columns: repeat(3, 66.675mm);
                          grid-template-rows: repeat(10, 25.4mm);
                          column-gap: 3.429mm;
                          row-gap: 0;
                        }
                        .label-container {
                          width: 66.675mm;
                          height: 25.4mm;
                          padding: 2mm 4mm;
                          box-sizing: border-box;
                          display: flex;
                          flex-direction: column;
                          justify-content: space-between;
                          align-items: center;
                          border: 1px dashed rgba(0,0,0,0.05); /* very subtle boundary guides */
                          font-family: system-ui, sans-serif;
                          overflow: hidden;
                        }
                        .title {
                          font-size: 7.5pt;
                          font-weight: 800;
                          letter-spacing: 0.1em;
                          text-transform: uppercase;
                          line-height: 1;
                        }
                        .name {
                          font-size: 6.5pt;
                          font-weight: 600;
                          text-align: center;
                          white-space: nowrap;
                          overflow: hidden;
                          text-overflow: ellipsis;
                          width: 58mm;
                          line-height: 1.1;
                        }
                        .barcode-box {
                          display: flex;
                          flex-direction: column;
                          align-items: center;
                          margin: 1px 0;
                        }
                        .barcode-text {
                          font-size: 5.5pt;
                          font-family: monospace;
                          letter-spacing: 0.1em;
                          margin-top: 1px;
                          font-weight: bold;
                        }
                        .price {
                          font-size: 8.5pt;
                          font-weight: 800;
                          line-height: 1;
                        }
                      `;

                      const pages: (typeof printableItems)[] = [];
                      for (let i = 0; i < printableItems.length; i += 30) {
                        pages.push(printableItems.slice(i, i + 30));
                      }

                      bodyHtml = pages.map(page => `
                        <div class="sheet-page">
                          ${page.map(item => `
                            <div class="label-container">
                              <div class="title">REXERMI</div>
                              <div class="name">${item.name}</div>
                              <div class="barcode-box">
                                ${generateBarcodeSVGString(item.barcode, 0.8, 22)}
                                <div class="barcode-text">${item.barcode}</div>
                              </div>
                              <div class="price">${includePrice ? `$${Number(item.price).toFixed(2)}` : ''}</div>
                            </div>
                          `).join('')}
                        </div>
                      `).join('');
                    }

                    const labelHtml = `
                      <html>
                        <head>
                          <title>Imprimir Etiquetas</title>
                          <style>${styleTag}</style>
                        </head>
                        <body>
                          ${bodyHtml}
                          <script>
                            window.onload = function() {
                              window.print();
                              setTimeout(function() { window.close(); }, 500);
                            }
                          </script>
                        </body>
                      </html>
                    `;

                    printWindow.document.write(labelHtml);
                    printWindow.document.close();
                  }
                }}
              >
                🖨&nbsp;Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Batch Actions Bar */}
      {selectedIds.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(10, 10, 15, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--gold)',
          borderRadius: '12px',
          padding: '1rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          zIndex: 100,
          boxShadow: '0 8px 32px rgba(212, 175, 55, 0.25)',
          animation: 'fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>
            🏷️ <span style={{ color: 'var(--gold)' }}>{selectedIds.length}</span> seleccionados
          </span>
          <div style={{ display: 'flex', gap: '0.8rem' }}>
            <button
              onClick={() => {
                const selectedProds = initialProducts.filter(p => selectedIds.includes(p.id));
                const toPrint = selectedProds.map(p => ({
                  id: p.id,
                  name: p.name,
                  barcode: p.barcode || '',
                  price: p.price,
                  quantity: 1
                }));
                setProductsToPrint(toPrint);
                setTemplateType('thermal');
                setIncludePrice(false);
                setIsLabelModalOpen(true);
              }}
              style={{
                padding: '0.5rem 1.2rem',
                background: '#3498db',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.85rem',
                transition: 'all 0.15s ease',
                boxShadow: '0 2px 8px rgba(52,152,219,0.3)'
              }}
            >
              🖨️ Imprimir Etiquetas
            </button>
            <button
              onClick={() => setIsBatchModalOpen(true)}
              style={{
                padding: '0.5rem 1.2rem',
                background: 'var(--gold)',
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.85rem',
                transition: 'all 0.15s ease',
                boxShadow: '0 2px 8px rgba(212,175,55,0.3)'
              }}
            >
              📊 Ajustar Precios
            </button>
            <button
              onClick={() => setSelectedIds([])}
              style={{
                padding: '0.5rem 1.2rem',
                background: 'rgba(255,255,255,0.08)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem'
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Batch Price Update Modal */}
      {isBatchModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg2)',
            border: '2px solid var(--gold)',
            borderRadius: '16px',
            padding: '2rem',
            width: '100%',
            maxWidth: '450px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            position: 'relative'
          }}>
            <h3 style={{ color: 'var(--gold)', margin: '0 0 1.2rem 0', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📊 Ajuste Masivo de Precios
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 1.5rem 0', lineHeight: '1.4' }}>
              Estás modificando el precio de <strong>{selectedIds.length}</strong> productos seleccionados.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', marginBottom: '1.8rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
                  Dirección del Ajuste
                </label>
                <select
                  value={batchPriceDirection}
                  onChange={e => setBatchPriceDirection(e.target.value as any)}
                  style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }}
                >
                  <option value="increase">📈 Aumentar Precios</option>
                  <option value="decrease">📉 Reducir Precios</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
                  Tipo de Ajuste
                </label>
                <select
                  value={batchPriceType}
                  onChange={e => setBatchPriceType(e.target.value as any)}
                  style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }}
                >
                  <option value="percentage">Porcentaje (%)</option>
                  <option value="flat">Monto Fijo ($ USD)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
                  Valor del Ajuste ({batchPriceType === 'percentage' ? '%' : '$ USD'})
                </label>
                <input
                  type="number"
                  placeholder={batchPriceType === 'percentage' ? 'Ej: 10' : 'Ej: 1.50'}
                  value={batchPriceValue}
                  onChange={e => setBatchPriceValue(e.target.value)}
                  min="0"
                  step="any"
                  style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem 1rem', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setIsBatchModalOpen(false);
                  setBatchPriceValue('');
                }}
                disabled={batchUpdating}
                style={{ padding: '0.65rem 1.5rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleBatchPriceUpdate}
                disabled={batchUpdating}
                style={{
                  padding: '0.65rem 1.8rem',
                  background: 'var(--gold)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  boxShadow: '0 4px 12px rgba(212,175,55,0.25)',
                  opacity: batchUpdating ? 0.7 : 1
                }}
              >
                {batchUpdating ? 'Aplicando...' : 'Aplicar Cambio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
