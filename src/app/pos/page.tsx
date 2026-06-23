'use client';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { formatPrice, triggerHaptic } from '@/lib/helpers';
import { useToast } from '@/context/ToastContext';
import { useCurrency } from '@/context/CurrencyContext';
import BarcodeScannerModal from '@/components/BarcodeScannerModal';
import CameraScanner from '@/components/CameraScanner';
interface Product { id: number; name: string; price: number; stock: number; type: 'product' | 'service'; image?: string; barcode?: string | null; category_id?: number | null; cost_price?: number; cat_name?: string; price_type?: string; price_max?: number | null; }
interface CartItem extends Product { cartQuantity: number; }
interface Customer { id: number; full_name: string; id_document: string; phone: string; email?: string; credit_limit?: number; credit_used?: number; loyalty_points?: number; credit_status?: string; }
interface Order { 
  id: number; 
  order_number: string; 
  status: string; 
  subtotal: number;
  shipping_cost: number;
  total: number; 
  created_at: string; 
  payment_method: string; 
  customer_name: string | null; 
  customer_phone?: string | null;
  customer_email?: string | null;
  shipping_address?: string | null;
  shipping_city?: string | null;
  shipping_method?: string | null;
  customer_message?: string | null;
  payment_ref?: string | null;
  payment_proof?: string | null;
  items_json?: string; 
  user_id?: number | null;
}
interface SwipeableCartItemProps {
  item: any;
  onDelete: () => void;
  children: React.ReactNode;
}
const SwipeableCartItem = ({ item, onDelete, children }: SwipeableCartItemProps) => {
  const [startX, setStartX] = React.useState(0);
  const [offsetX, setOffsetX] = React.useState(0);
  const [isSwiping, setIsSwiping] = React.useState(false);
  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setIsSwiping(true);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    const currentX = e.touches[0].clientX;
    const diffX = currentX - startX;
    if (diffX < 0) {
      setOffsetX(Math.max(-90, diffX));
    } else {
      setOffsetX(0);
    }
  };
  const handleTouchEnd = () => {
    setIsSwiping(false);
    if (offsetX < -65) {
      onDelete();
    }
    setOffsetX(0);
  };
  return (
    <div 
      style={{ position: 'relative', overflow: 'hidden', width: '100%', borderRadius: '8px', marginBottom: '0.4rem' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '90px',
          background: '#e74c3c',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.85rem',
          fontWeight: 'bold',
          zIndex: 1,
          opacity: offsetX < -10 ? 1 : 0,
          transition: 'opacity 0.2s ease'
        }}
      >
        🗑️ Borrar
      </div>
      <div 
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          zIndex: 2,
          position: 'relative'
        }}
      >
        {children}
      </div>
    </div>
  );
};
export default function VendedorPOS() {
  const { showToast } = useToast();
  const { currency, setCurrency, dollarRate, formatPriceLocal, formatProductPrice } = useCurrency();
  // Phase 2 Mobile States
  const [isLocked, setIsLocked] = useState(false);
  const [savedPin, setSavedPin] = useState<string | null>(null);
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [activeNumpadField, setActiveNumpadField] = useState<any>(null);
  // Suspended Carts States
  const [suspendedCarts, setSuspendedCarts] = useState<any[]>([]);
  const [isSuspendedModalOpen, setIsSuspendedModalOpen] = useState(false);
  // Flexible Discounts State
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  // Generic Product Modal State
  const [isGenericModalOpen, setIsGenericModalOpen] = useState(false);
  const [genericName, setGenericName] = useState('Artículo Genérico');
  const [genericPrice, setGenericPrice] = useState('1.0');
  const [genericQty, setGenericQty] = useState('1');
  // Recent Sales State
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [isRecentSalesOpen, setIsRecentSalesOpen] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(false);
  // Current cashier user session state
  const [currentCashier, setCurrentCashier] = useState<any>(null);
  // Customer credit abono state
  const [isAbonoModalOpen, setIsAbonoModalOpen] = useState(false);
  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoPaymentMethod, setAbonoPaymentMethod] = useState('Efectivo');
  const [abonoReference, setAbonoReference] = useState('');
  const [processingAbono, setProcessingAbono] = useState(false);
  // Quick switch session state
  const [isQuickSwitchOpen, setIsQuickSwitchOpen] = useState(false);
  const [quickSwitchPin, setQuickSwitchPin] = useState('');
  const [isConfiguringPin, setIsConfiguringPin] = useState(false);
  const [pinSettingPassword, setPinSettingPassword] = useState('');
  const [pinSettingNewPin, setPinSettingNewPin] = useState('');
  // Keyboard Shortcuts Help state
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [helpActiveTab, setHelpActiveTab] = useState<'shortcuts' | 'features'>('shortcuts');
  const renderNumpad = () => {
    if (!activeNumpadField) return null;
    let label = '';
    if (activeNumpadField === 'discount') label = 'Descuento';
    else if (activeNumpadField === 'received') label = 'Monto Recibido';
    else if (typeof activeNumpadField === 'object') label = `Pago Mixto - ${activeNumpadField.name}`;
    return (
      <div style={{
        background: 'var(--bg3)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '0.8rem',
        marginTop: '0.8rem',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--gold)' }}>🎹 Teclado: {label}</span>
          <button 
            type="button"
            onClick={() => { triggerHaptic('medium'); setActiveNumpadField(null); }}
            style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Listo ✓
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '.'].map(key => (
            <button
              key={key}
              type="button"
              onClick={() => handleNumpadPress(key)}
              style={{
                padding: '0.65rem',
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                borderRadius: '8px',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.1s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
              }}
              className="numpad-key"
            >
              {key}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleNumpadPress('⌫')}
            style={{
              gridColumn: 'span 3',
              padding: '0.65rem',
              background: 'rgba(231,76,60,0.12)',
              border: '1px solid rgba(231,76,60,0.3)',
              color: '#e74c3c',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            ⌫ Borrar
          </button>
        </div>
      </div>
    );
  };
  const [tab, setTab] = useState<'pos' | 'orders'>('pos');
  const [mobileView, setMobileView] = useState<'catalog' | 'cart'>('catalog');
  // Offline & Scanner State
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [offlineQueueLength, setOfflineQueueLength] = useState(0);
  const fetchWithAuth = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const res = await fetch(input, init);
      if (res.status === 401) {
        showToast('Sesión expirada. Redirigiendo...', 'error');
        setTimeout(() => {
          window.location.href = '/login';
        }, 1500);
      }
      return res;
    } catch (err) {
      console.error('Network error in fetchWithAuth:', err);
      throw err;
    }
  };
  
  // Settings & Exchange Rate
  const [settings, setSettings] = useState<Record<string, string>>({});
  // Cash Closure state
  const [activeClosure, setActiveClosure] = useState<any>(null);
  const [showClosureModal, setShowClosureModal] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('100.0');
  const [closureNotes, setClosureNotes] = useState('');
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [actualCashAmount, setActualCashAmount] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [printType, setPrintType] = useState<'order' | 'closure'>('order');
  const [lastClosureForPrint, setLastClosureForPrint] = useState<any>(null);
  // POS State
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [loadingPMs, setLoadingPMs] = useState(true);
  const [paymentRef, setPaymentRef] = useState('');
  const [processing, setProcessing] = useState(false);
  const [paymentProof, setPaymentProof] = useState<string | null>(null);
  
  // POS Checkout modifiers
  const [discountAmount, setDiscountAmount] = useState<string>('');
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [changeCurrency, setChangeCurrency] = useState<'usd' | 'bs'>('usd');
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [originalOrderItems, setOriginalOrderItems] = useState<{ id: number; quantity: number }[]>([]);
  // Mixed Payment States
  const [mixedPayments, setMixedPayments] = useState<Record<string, string>>({});
  const [mixedReferences, setMixedReferences] = useState<Record<string, string>>({});
  // Customer State
  const [customerSearchDoc, setCustomerSearchDoc] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([]);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerDoc, setNewCustomerDoc] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  // Orders State
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  // Print & Receipt
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [autoPrint, setAutoPrint] = useState(true);
  // Virtual catalog scroll state
  const [visibleCount, setVisibleCount] = useState(80);
  const observerRef = useRef<HTMLDivElement>(null);
  // Suggestions state for zero-stock alerts
  const [stockAlertProduct, setStockAlertProduct] = useState<Product | null>(null);
  // Mobile Usability States
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  // POS Redesign States
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'customer' | 'payment'>('customer');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isTurnoDropdownOpen, setIsTurnoDropdownOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogVisibleCount, setCatalogVisibleCount] = useState(60);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileStep, setMobileStep] = useState<'cart' | 'customer' | 'payment'>('cart');
  const catalogSearchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 992);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  useEffect(() => {
    if (isCatalogModalOpen) {
      setCatalogSearch(search);
      setTimeout(() => {
        catalogSearchRef.current?.focus();
      }, 50);
    }
  }, [isCatalogModalOpen]);
  const catalogFilteredProducts = useMemo(() => {
    let result = products;
    
    if (selectedCategory) {
      result = result.filter(p => p.cat_name === selectedCategory);
    }
    
    const s = catalogSearch.toLowerCase().trim();
    if (s) {
      result = result.filter(p =>
        p.name.toLowerCase().includes(s) ||
        p.id.toString().includes(s) ||
        (p.barcode && p.barcode.toLowerCase().includes(s))
      );
    }
    
    return result;
  }, [products, selectedCategory, catalogSearch]);
  const handleCatalogScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100) {
      setCatalogVisibleCount(prev => Math.min(prev + 40, catalogFilteredProducts.length));
    }
  };
  useEffect(() => {
    setCatalogVisibleCount(60);
  }, [catalogSearch, selectedCategory]);
  useEffect(() => {
    const cachedPin = localStorage.getItem('rexermi_pos_lock_pin');
    if (cachedPin) {
      setSavedPin(cachedPin);
    }
  }, []);
  const handleLockPOS = () => {
    triggerHaptic('medium');
    setPinInput('');
    if (!savedPin) {
      setIsSettingPin(true);
    } else {
      setIsLocked(true);
    }
  };
  const handlePinKeyPress = (val: string) => {
    triggerHaptic('light');
    if (val === '⌫') {
      setPinInput(prev => prev.slice(0, -1));
    } else if (val === 'Clear') {
      setPinInput('');
    } else {
      if (pinInput.length < 4) {
        const nextPin = pinInput + val;
        setPinInput(nextPin);
        if (nextPin.length === 4) {
          if (nextPin === savedPin) {
            triggerHaptic('success');
            setIsLocked(false);
            setPinInput('');
            showToast('Terminal desbloqueado exitosamente.', 'success');
          } else {
            triggerHaptic('warning');
            showToast('PIN incorrecto. Reintente.', 'error');
            setPinInput('');
          }
        }
      }
    }
  };
  const handleSettingPinKeyPress = (val: string) => {
    triggerHaptic('light');
    if (val === '⌫') {
      setPinInput(prev => prev.slice(0, -1));
    } else if (val === 'Clear') {
      setPinInput('');
    } else {
      if (pinInput.length < 4) {
        const nextPin = pinInput + val;
        setPinInput(nextPin);
        if (nextPin.length === 4) {
          triggerHaptic('success');
          localStorage.setItem('rexermi_pos_lock_pin', nextPin);
          setSavedPin(nextPin);
          setIsSettingPin(false);
          setIsLocked(true);
          setPinInput('');
          showToast('PIN de seguridad configurado y terminal bloqueado. 🔒', 'success');
        }
      }
    }
  };
  const handleNumpadPress = (val: string) => {
    triggerHaptic('light');
    const updateVal = (prev: string) => {
      if (val === '⌫') return prev.slice(0, -1);
      if (val === 'C') return '';
      if (val === '.' && prev.includes('.')) return prev;
      return prev + val;
    };
    if (activeNumpadField === 'discount') {
      setDiscountAmount(prev => updateVal(prev));
    } else if (activeNumpadField === 'received') {
      setAmountReceived(prev => updateVal(prev));
    } else if (activeNumpadField && typeof activeNumpadField === 'object' && activeNumpadField.type === 'mixed') {
      const pmName = activeNumpadField.name;
      setMixedPayments(prev => {
        const current = prev[pmName] || '';
        const next = updateVal(current);
        return { ...prev, [pmName]: next };
      });
  
    }
  };
  const renderCartListSection = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Search and Catalog Row */}
        <div style={{
          padding: '1rem',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg2)',
          display: 'flex',
          gap: '0.6rem',
          alignItems: 'center',
          flexWrap: isMobile ? 'wrap' : 'nowrap'
        }}>
          <div style={{ position: 'relative', flex: isMobile ? '1 1 100%' : 1, width: isMobile ? '100%' : 'auto' }}>
            <input
              ref={searchInputRef}
              id="posSearchInput"
              type="text"
              placeholder="🔍 Escanee código de barras o busque... [Atajo: F2]"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleBarcodeSearch}
              className="pos-input"
              style={{ width: '100%' }}
            />
          </div>
          <div style={{
            display: 'flex',
            gap: '0.4rem',
            width: isMobile ? '100%' : 'auto',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            marginTop: isMobile ? '0.2rem' : '0',
            flex: isMobile ? '1 1 100%' : 'none'
          }}>
            <button
              type="button"
              onClick={() => setIsCatalogModalOpen(true)}
              style={{
                background: 'rgba(212,175,55,0.15)',
                border: '1.5px solid var(--gold)',
                color: 'var(--gold)',
                borderRadius: '10px',
                height: '42px',
                padding: '0 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                transition: 'all 0.2s ease',
                flex: isMobile ? 1 : 'none',
                whiteSpace: 'nowrap'
              }}
              title="Abrir Catálogo Visual de Productos [F2]"
            >
              🔍 Catálogo (F2)
            </button>
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              style={{
                background: 'rgba(212,175,55,0.15)',
                border: '1.5px solid var(--gold)',
                color: 'var(--gold)',
                borderRadius: '10px',
                height: '42px',
                width: '42px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
              title="Escanear con cámara del dispositivo"
            >
              📷
            </button>
            <button
              type="button"
              onClick={() => setIsGenericModalOpen(true)}
              style={{
                background: 'rgba(212,175,55,0.15)',
                border: '1.5px solid var(--gold)',
                color: 'var(--gold)',
                borderRadius: '10px',
                height: '42px',
                padding: '0 0.8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                transition: 'all 0.2s ease',
                flex: isMobile ? 1 : 'none',
                whiteSpace: 'nowrap'
              }}
              title="Agregar producto genérico / servicio personalizado"
            >
              ➕ Item Genérico
            </button>
          </div>
        </div>
        {/* Cart Items List Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          {activeOrderId && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', padding: '0.6rem 0.8rem', borderRadius: '6px', marginBottom: '0.8rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--gold)' }}>
                🔄 Procesando Pedido Online
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveOrderId(null);
                  setOriginalOrderItems([]);
                  setCart([]);
                  setMobileStep('cart');
                  setSelectedCustomer(null);
                  localStorage.removeItem('rexermi_pos_original_items');
                  showToast('Procesamiento de pedido online cancelado.', 'info');
                }}
                style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
              >
                Desvincular
              </button>
            </div>
          )}
          {cart.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', minHeight: '180px' }}>
              <span style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🛒</span>
              <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>Ticket vacío</div>
              <div style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>Escanee productos o use F2 para buscar</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {cart.map(item => (
                <SwipeableCartItem
                  key={item.id}
                  item={item}
                  onDelete={() => {
                    setCart(cart.filter(c => c.id !== item.id));
                    showToast(`Removido: ${item.name}`, 'info');
                    triggerHaptic('medium');
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border)', padding: '0.6rem 0.8rem', background: 'var(--bg2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ flex: 1, marginRight: '0.5rem' }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                        {item.name}
                        {item.price_type === 'base' && (
                          <span style={{ fontSize: '0.68rem', color: '#B8961B', background: 'rgba(212,175,55,0.12)', padding: '1px 5px', borderRadius: '4px', marginLeft: '0.4rem', fontWeight: 'bold' }}>
                            [Precio Base]
                          </span>
                        )}
                        {item.price_type === 'range' && (
                          <span style={{ fontSize: '0.68rem', color: '#B8961B', background: 'rgba(212,175,55,0.12)', padding: '1px 5px', borderRadius: '4px', marginLeft: '0.4rem', fontWeight: 'bold' }}>
                            [Precio Variable]
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                        <span>
                          {item.price_type === 'base' ? 'Desde ' : ''}
                          {formatPriceLocal(item.price)}
                          {item.price_type === 'range' && item.price_max ? ` - ${formatPriceLocal(item.price_max)}` : ''} c/u
                        </span>
                      </div>
                    </div>
                    {/* Quantity selector buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button
                          type="button"
                          onClick={() => updateCartItemQuantity(item.id, item.cartQuantity - 1, item.stock, item.type === 'service')}
                          className="pos-qty-btn"
                        >
                          -
                        </button>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: '18px', textAlign: 'center' }}>
                          {item.cartQuantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartItemQuantity(item.id, item.cartQuantity + 1, item.stock, item.type === 'service')}
                          className="pos-qty-btn"
                        >
                          +
                        </button>
                      </div>
                      <span style={{ fontWeight: 'bold', fontSize: '0.88rem', minWidth: '70px', textAlign: 'right', color: 'var(--gold)' }}>
                        {formatPriceLocal(item.price * item.cartQuantity)}
                      </span>
                      <button type="button" onClick={() => { setCart(cart.filter(c => c.id !== item.id)); showToast(`Removido: ${item.name}`, 'info'); triggerHaptic('medium'); }} style={{ background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer', fontSize: '1.2rem', padding: '0 0.2rem' }}>×</button>
                    </div>
                  </div>
                </SwipeableCartItem>
              ))}
            </div>
          )}
        </div>
        {/* Subtotal, discount & Proceed to payment */}
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', background: 'var(--bg3)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <span>Subtotal:</span>
            <span style={{ fontWeight: 600 }}>{formatPriceLocal(subtotal)}</span>
          </div>
          
          {discountVal > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#ff4d4f' }}>
              <span>Descuento aplicado:</span>
              <span style={{ fontWeight: 600 }}>-{formatPriceLocal(discountVal)}</span>
            </div>
          )}
          {/* Warnings for variable prices */}
          {cart.some(item => item.price_type === 'base' || item.price_type === 'range') && (
            <div style={{
              background: 'rgba(212,175,55,0.08)',
              border: '1px solid rgba(212,175,55,0.2)',
              borderRadius: '6px',
              padding: '0.5rem',
              fontSize: '0.78rem',
              color: 'var(--gold)',
              fontWeight: 500
            }}>
              ⚠️ Uno o más ítems tienen precio variable. El total es estimado y se acordará al finalizar.
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Total Estimado:</span>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--gold)' }}>{formatPriceLocal(total)}</div>
              {dollarRate > 0 && currency === 'USD' && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>≈ {(total * dollarRate).toFixed(2)} Bs.</div>
              )}
              {currency === 'VES' && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>≈ ${total.toFixed(2)}</div>
              )}
            </div>
          </div>
          {checkoutStep === 'customer' && cart.length > 0 && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setCheckoutStep('payment');
                setMobileStep('payment');
              }}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '0.8rem',
                fontSize: '1rem',
                fontWeight: 'bold',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                marginTop: '0.3rem'
              }}
            >
              Proceder al Pago (F5) ➔
            </button>
          )}
          {checkoutStep === 'payment' && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setCheckoutStep('customer');
                setMobileStep('customer');
              }}
              style={{
                width: '100%',
                padding: '0.5rem',
                background: 'none',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                textAlign: 'center',
                marginTop: '0.2rem'
              }}
            >
              « Modificar Cliente o Descuento (F4)
            </button>
          )}
        </div>
        {/* Collapsible Recent Sales section */}
        <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg2)', padding: '0.8rem 1rem', flexShrink: 0 }}>
          <div
            onClick={() => {
              triggerHaptic('light');
              const nextState = !isRecentSalesOpen;
              setIsRecentSalesOpen(nextState);
              if (nextState) {
                fetchCompletedOrders();
              }
            }}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🗂️ Ventas Recientes del Turno
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {isRecentSalesOpen ? '▲ Ocultar' : '▼ Mostrar (Últimas 10)'}
            </span>
          </div>
          {isRecentSalesOpen && (
            <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '180px', overflowY: 'auto' }}>
              {loadingRecent ? (
                <div style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', padding: '1rem' }}>
                  Cargando ventas recientes...
                </div>
              ) : completedOrders.length === 0 ? (
                <div style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', padding: '1rem' }}>
                  No hay ventas completadas en este turno.
                </div>
              ) : (
                completedOrders.slice(0, 10).map(order => {
                  let items: any[] = [];
                  try {
                    items = order.items_json ? JSON.parse(order.items_json) : [];
                  } catch (e) {
                    console.error('Error parsing items_json:', e);
                  }
                  return (
                    <div
                      key={order.id}
                      style={{
                        background: 'var(--bg3)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        padding: '0.8rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                        fontSize: '0.8rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold' }}>
                        <span style={{ color: 'var(--gold)' }}>{order.order_number}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                          {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                        <span>Cliente: {order.customer_name || 'Venta en Mostrador'}</span>
                        <span style={{ fontWeight: 'bold' }}>{formatPriceLocal(order.total)}</span>
                      </div>
                      {items.length > 0 && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border)', paddingTop: '0.3rem', marginTop: '0.2rem' }}>
                          {items.map((it: any) => (
                            <div key={it.id || it.product_id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>{it.quantity || it.cartQuantity}x {it.name || it.product_name}</span>
                              <span>{formatPriceLocal((it.price || 0) * (it.quantity || it.cartQuantity))}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '0.4rem', borderTop: '1px solid var(--border)', paddingTop: '0.4rem', marginTop: '0.2rem' }}>
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            const formattedItems = items.map((it: any) => ({
                              id: it.id || it.product_id || 0,
                              name: it.name || it.product_name,
                              price: it.price,
                              cartQuantity: it.quantity || it.cartQuantity || 1,
                              type: it.type || 'product'
                            }));
                            const orderForPrint = {
                              orderNumber: order.order_number,
                              date: new Date(order.created_at).toLocaleString(),
                              customer: order.customer_name ? { full_name: order.customer_name } : null,
                              paymentMethod: order.payment_method,
                              items: formattedItems,
                              discount: (order.subtotal || 0) - (order.total || 0) > 0 ? (order.subtotal || 0) - (order.total || 0) : 0,
                              total: order.total
                            };
                            setPrintType('order');
                            setLastOrder(orderForPrint);
                            setTimeout(() => {
                              window.print();
                            }, 250);
                          }}
                          style={{
                            flex: 1,
                            padding: '4px 8px',
                            background: 'rgba(212,175,55,0.1)',
                            border: '1px solid var(--gold)',
                            color: 'var(--gold)',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            fontWeight: 'bold'
                          }}
                        >
                          🖨️ Reimprimir
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            triggerHaptic('warning');
                            await handleCancelOrder(order.id);
                          }}
                          style={{
                            flex: 1,
                            padding: '4px 8px',
                            background: 'rgba(231,76,60,0.1)',
                            border: '1px solid #e74c3c',
                            color: '#e74c3c',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            fontWeight: 'bold'
                          }}
                        >
                          🗑️ Anular
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    );
  };
  const renderCheckoutWizardSection = () => {
    const selectedPM = paymentMethods.find(pm => String(pm.id) === String(paymentMethod));
    const requiresProof = selectedPM ? selectedPM.requires_proof : false;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Step Wizard Navigation Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => { triggerHaptic('light'); setCheckoutStep('customer'); setMobileStep('customer'); }}
            style={{
              flex: 1,
              padding: '0.8rem 0.5rem',
              background: checkoutStep === 'customer' ? 'rgba(212,175,55,0.08)' : 'none',
              border: 'none',
              color: checkoutStep === 'customer' ? 'var(--gold)' : 'var(--text-muted)',
              borderBottom: checkoutStep === 'customer' ? '2.5px solid var(--gold)' : '2.5px solid transparent',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              transition: 'all 0.2s'
            }}
          >
            👤 1. Cliente y Descuento
          </button>
          <button
            type="button"
            onClick={() => { triggerHaptic('light'); setCheckoutStep('payment'); setMobileStep('payment'); }}
            style={{
              flex: 1,
              padding: '0.8rem 0.5rem',
              background: checkoutStep === 'payment' ? 'rgba(212,175,55,0.08)' : 'none',
              border: 'none',
              color: checkoutStep === 'payment' ? 'var(--gold)' : 'var(--text-muted)',
              borderBottom: checkoutStep === 'payment' ? '2.5px solid var(--gold)' : '2.5px solid transparent',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              transition: 'all 0.2s'
            }}
          >
            💵 2. Método de Pago
          </button>
        </div>
        {/* Step Content Container */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* STEP 1: Customer / Discount */}
          {checkoutStep === 'customer' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Action Bar for Suspended Carts */}
              <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg2)', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={handleSuspendCart}
                  disabled={cart.length === 0}
                  className="pos-action-btn"
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    opacity: cart.length === 0 ? 0.5 : 1,
                    cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                    padding: '0.4rem',
                    fontSize: '0.78rem',
                    fontWeight: 'bold'
                  }}
                  title="Suspender carrito actual [Atajo: F4 o Alt+W]"
                >
                  ⏸️ Suspender
                </button>
                <button
                  type="button"
                  onClick={() => setIsSuspendedModalOpen(true)}
                  className="pos-action-btn"
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    color: 'var(--gold)',
                    padding: '0.4rem',
                    fontSize: '0.78rem',
                    fontWeight: 'bold'
                  }}
                  title="Ver ventas en espera [Atajo: F7 o Alt+E]"
                >
                  📂 En Espera ({suspendedCarts.length})
                </button>
                <button
                  type="button"
                  onClick={handleClearCart}
                  disabled={cart.length === 0}
                  className="pos-action-btn"
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    color: '#ff4d4f',
                    border: '1px solid rgba(255, 77, 79, 0.2)',
                    background: 'rgba(255, 77, 79, 0.05)',
                    opacity: cart.length === 0 ? 0.5 : 1,
                    cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                    padding: '0.4rem',
                    fontSize: '0.78rem',
                    fontWeight: 'bold'
                  }}
                  title="Vaciar carrito actual [Atajo: ESC o Alt+X]"
                >
                  🗑️ Vaciar
                </button>
              </div>
              {/* Customer Selection Block */}
              <div style={{ background: 'var(--bg2)', padding: '0.8rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--gold)', marginBottom: '0.5rem' }}>
                  👤 Cliente Asociado
                </label>
                {selectedCustomer ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg3)', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 'bold' }}>{selectedCustomer.full_name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {selectedCustomer.id_document ? `C.I: ${selectedCustomer.id_document}` : `Telf: ${selectedCustomer.phone}`}
                      </div>
                      {selectedCustomer.credit_limit !== undefined && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--gold)', marginTop: '4px', fontWeight: 600 }}>
                          💳 Lim. Crédito Disponible: ${(selectedCustomer.credit_limit - (selectedCustomer.credit_used || 0)).toFixed(2)} USD
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-end' }}>
                      {(selectedCustomer.credit_used || 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => { triggerHaptic('light'); setIsAbonoModalOpen(true); }}
                          className="pos-action-btn"
                          style={{ padding: '2px 8px', fontSize: '0.72rem', border: '1px solid var(--gold)', color: 'var(--gold)', background: 'rgba(212,175,55,0.08)' }}
                        >
                          💵 Abonar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedCustomer(null)}
                        style={{ background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', position: 'relative' }}>
                      <input
                        id="customerSearchInput"
                        type="text"
                        placeholder="Buscar cliente (Cédula, nombre...) [F9]"
                        value={customerSearchDoc}
                        onChange={e => handleCustomerSearchChange(e.target.value)}
                        className="pos-input"
                        style={{ flex: 1, fontSize: '0.82rem' }}
                      />
                      <button
                        type="button"
                        onClick={searchCustomerManual}
                        className="pos-action-btn"
                        style={{ padding: '0 0.8rem', fontSize: '0.8rem', height: '38px' }}
                      >
                        Buscar
                      </button>
                      {customerSearchResults.length > 0 && (
                        <div style={{
                          position: 'absolute', top: '100%', left: '0', right: '0', marginTop: '0.3rem',
                          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 100, maxHeight: '180px', overflowY: 'auto'
                        }}>
                          {customerSearchResults.map(c => (
                            <div
                              key={c.id}
                              onClick={() => selectCustomer(c)}
                              style={{
                                padding: '0.6rem 0.8rem', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                                display: 'flex', flexDirection: 'column', transition: 'background 0.2s'
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <span style={{ fontWeight: 'bold', fontSize: '0.82rem' }}>{c.full_name}</span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>C.I: {c.id_document || '—'} | Telf: {c.phone}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Toggle Customer Reg Form */}
                    {!showCustomerForm && (
                      <button
                        type="button"
                        onClick={() => setShowCustomerForm(true)}
                        style={{
                          background: 'none',
                          border: '1px dashed var(--border)',
                          color: 'var(--text-muted)',
                          padding: '0.4rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      >
                        ➕ Registrar Nuevo Cliente
                      </button>
                    )}
                    {showCustomerForm && (
                      <div style={{
                        background: 'var(--bg3)',
                        padding: '0.8rem',
                        borderRadius: '8px',
                        border: '1px dashed var(--gold)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.6rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--gold)' }}>
                            Registrar Nuevo Cliente
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowCustomerForm(false)}
                            style={{ background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer', fontSize: '0.78rem' }}
                          >
                            Cancelar
                          </button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.1rem' }}>Nombre *</label>
                            <input
                              type="text"
                              placeholder="Nombre..."
                              value={newCustomerName}
                              onChange={e => setNewCustomerName(e.target.value)}
                              className="pos-input"
                              style={{ fontSize: '0.78rem', padding: '0.3rem 0.5rem' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.1rem' }}>Cédula *</label>
                            <input
                              type="text"
                              placeholder="V-12345678"
                              value={newCustomerDoc}
                              onChange={e => setNewCustomerDoc(e.target.value)}
                              className="pos-input"
                              style={{ fontSize: '0.78rem', padding: '0.3rem 0.5rem' }}
                            />
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.1rem' }}>Teléfono *</label>
                            <input
                              type="text"
                              placeholder="0414..."
                              value={newCustomerPhone}
                              onChange={e => setNewCustomerPhone(e.target.value)}
                              className="pos-input"
                              style={{ fontSize: '0.78rem', padding: '0.3rem 0.5rem' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.1rem' }}>Correo</label>
                            <input
                              type="email"
                              placeholder="cliente@..."
                              value={newCustomerEmail}
                              onChange={e => setNewCustomerEmail(e.target.value)}
                              className="pos-input"
                              style={{ fontSize: '0.78rem', padding: '0.3rem 0.5rem' }}
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={registerCustomer}
                          className="btn-primary"
                          style={{ width: '100%', minHeight: '34px', padding: '0.4rem', fontSize: '0.8rem', borderRadius: '6px' }}
                        >
                          Guardar y Seleccionar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* Discounts Section */}
              <div style={{ background: 'var(--bg2)', padding: '0.8rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--gold)' }}>
                    🏷️ Descuento Especial
                  </label>
                  <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                    <button
                      type="button"
                      onClick={() => setDiscountType('amount')}
                      style={{
                        padding: '2px 6px',
                        fontSize: '0.72rem',
                        border: 'none',
                        cursor: 'pointer',
                        background: discountType === 'amount' ? 'var(--gold)' : 'var(--bg3)',
                        color: discountType === 'amount' ? '#000' : 'var(--text-muted)',
                        fontWeight: 'bold'
                      }}
                    >
                      $
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('percent')}
                      style={{
                        padding: '2px 6px',
                        fontSize: '0.72rem',
                        border: 'none',
                        cursor: 'pointer',
                        background: discountType === 'percent' ? 'var(--gold)' : 'var(--bg3)',
                        color: discountType === 'percent' ? '#000' : 'var(--text-muted)',
                        fontWeight: 'bold'
                      }}
                    >
                      %
                    </button>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={discountAmount}
                    onChange={e => setDiscountAmount(e.target.value)}
                    className="pos-input"
                    style={{ flex: 1, textAlign: 'right', fontSize: '0.82rem' }}
                  />
                  {discountType === 'percent' && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>%</span>}
                </div>
                {discountType === 'percent' && discountVal > 0 && (
                  <div style={{ fontSize: '0.72rem', color: '#ff4d4f', textAlign: 'right', marginTop: '0.2rem' }}>
                    ≈ -{formatPriceLocal(discountVal)}
                  </div>
                )}
                {totalCost > 0 && total > 0 && profitMargin < 10 && (
                  <div style={{
                    background: 'rgba(231,76,60,0.1)',
                    border: '1px solid rgba(231,76,60,0.3)',
                    borderRadius: '6px',
                    padding: '0.5rem',
                    fontSize: '0.75rem',
                    color: '#e74c3c',
                    marginTop: '0.6rem',
                    fontWeight: 600
                  }}>
                    ⚠️ Ganancia Crítica: {profitMargin.toFixed(1)}% (Costo: {formatPriceLocal(totalCost)})
                  </div>
                )}
              </div>
            </div>
          )}
          {/* STEP 2: Payment Selector & Change Calculator */}
          {checkoutStep === 'payment' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {/* Payment Method Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '0.3rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Método de Pago Seleccionado
                </label>
                <select
                  id="paymentMethodSelect"
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="pos-input"
                  style={{ width: '100%', fontSize: '0.85rem', height: '38px' }}
                >
                  {loadingPMs ? (
                    <option value="">Cargando métodos...</option>
                  ) : paymentMethods.length === 0 ? (
                    <option value="">No hay métodos activos</option>
                  ) : (
                    <>
                      {paymentMethods.map(pm => (
                        <option key={pm.id} value={String(pm.id)}>
                          {pm.name} ({pm.type === 'online' ? 'Línea' : 'Físico'})
                        </option>
                      ))}
                      <option value="Mixto">🔄 Pago Mixto (Combinado)</option>
                    </>
                  )}
                </select>
              </div>
              {/* Pago Mixto Panel */}
              {paymentMethod === 'Mixto' && (
                <div style={{
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.8rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem'
                }}>
                  <h4 style={{ margin: 0, fontSize: '0.82rem', color: 'var(--gold)', fontWeight: 'bold' }}>
                    📊 Distribución de Pago Mixto
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
                    {paymentMethods.map(pm => {
                      const amountStr = mixedPayments[pm.name] || '';
                      const reference = mixedReferences[pm.name] || '';
                      const pmAmount = parseFloat(amountStr) || 0;
                      return (
                        <div key={pm.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.4rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.78rem' }}>{pm.name}</span>
                            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', width: '160px' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={amountStr}
                                onChange={e => {
                                  const val = e.target.value;
                                  setMixedPayments(prev => ({ ...prev, [pm.name]: val }));
                                }}
                                className="pos-input"
                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.78rem', textAlign: 'right' }}
                              />
                            </div>
                          </div>
                          {pm.requires_proof === 1 && pmAmount > 0 && (
                            <input
                              type="text"
                              placeholder="Referencia *"
                              value={reference}
                              onChange={e => {
                                const val = e.target.value;
                                setMixedReferences(prev => ({ ...prev, [pm.name]: val }));
                              }}
                              className="pos-input"
                              style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem', width: '100%', marginTop: '0.2rem' }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Live Validation */}
                  {(() => {
                    const assigned = Object.values(mixedPayments).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
                    const remaining = total - assigned;
                    const isMatched = Math.abs(remaining) < 0.01;
                    return (
                      <div style={{ fontSize: '0.78rem', paddingTop: '0.4rem', borderTop: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Total a pagar:</span>
                          <strong>{formatPriceLocal(total)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Asignado:</span>
                          <span style={{ color: isMatched ? 'var(--success)' : 'var(--gold)', fontWeight: 'bold' }}>
                            {formatPriceLocal(assigned)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Estado:</span>
                          {isMatched ? (
                            <span style={{ color: '#2ecc71', fontWeight: 'bold' }}>Listo ✅</span>
                          ) : remaining > 0 ? (
                            <span style={{ color: '#f1c40f', fontWeight: 'bold' }}>Faltan {formatPriceLocal(remaining)}</span>
                          ) : (
                            <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>Exceso de {formatPriceLocal(Math.abs(remaining))}</span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              {/* Cash Change Calculator */}
              {selectedPM && (selectedPM.category === 'cash' || selectedPM.name.toLowerCase().includes('efectivo') || selectedPM.name.toLowerCase().includes('cash')) && (() => {
                const pmName = selectedPM.name.toLowerCase();
                const isBsMethod = pmName.includes('bolívar') || pmName.includes('bolivar') || pmName.includes('bs') || pmName.includes('ves');
                const inputCurrency = isBsMethod ? 'Bs.' : '$';
                const received = parseFloat(amountReceived) || 0;
                const receivedInUsd = isBsMethod && dollarRate > 0 ? received / dollarRate : received;
                const changeUsd = receivedInUsd - total;
                const changeBs = changeUsd * dollarRate;
                const hasChange = changeUsd > 0.005;
                return (
                  <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.6rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Monto Recibido ({inputCurrency}):</span>
                      <input
                        id="amountReceivedInput"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={amountReceived}
                        onChange={e => setAmountReceived(e.target.value)}
                        onFocus={() => {
                          if (window.innerWidth < 992) {
                            setActiveNumpadField('received');
                          }
                        }}
                        className="pos-input"
                        style={{ width: '100px', textAlign: 'right', fontSize: '0.82rem', padding: '0.3rem' }}
                      />
                    </div>
                    {isBsMethod && dollarRate > 0 && received > 0 && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                        ≈ {formatPrice(receivedInUsd)} USD (Tasa: {dollarRate.toFixed(2)})
                      </div>
                    )}
                    {hasChange && dollarRate > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.2rem', paddingTop: '0.3rem', borderTop: '1px dashed var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Dar vuelto en:</span>
                          <div style={{ display: 'flex', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                            <button
                              type="button"
                              onClick={() => setChangeCurrency('usd')}
                              style={{
                                padding: '2px 8px',
                                fontSize: '0.72rem',
                                border: 'none',
                                cursor: 'pointer',
                                background: changeCurrency === 'usd' ? 'var(--gold)' : 'var(--bg3)',
                                color: changeCurrency === 'usd' ? '#000' : 'var(--text-muted)'
                              }}
                            >
                              USD
                            </button>
                            <button
                              type="button"
                              onClick={() => setChangeCurrency('bs')}
                              style={{
                                padding: '2px 8px',
                                fontSize: '0.72rem',
                                border: 'none',
                                cursor: 'pointer',
                                background: changeCurrency === 'bs' ? 'var(--gold)' : 'var(--bg3)',
                                color: changeCurrency === 'bs' ? '#000' : 'var(--text-muted)'
                              }}
                            >
                              Bs.
                            </button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                            {changeCurrency === 'usd' ? '💵 Vuelto USD:' : '🇻🇪 Vuelto Bs.:'}
                          </span>
                          <span style={{ fontWeight: 'bold', color: 'var(--success)', fontSize: '0.95rem' }}>
                            {changeCurrency === 'usd' ? formatPrice(changeUsd) : `${changeBs.toFixed(2)} Bs.`}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
              {/* Reference and Proof */}
              {requiresProof && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', background: 'var(--bg2)', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', marginBottom: '0.2rem', color: 'var(--text-muted)' }}>🔢 Referencia / Confirmación *</label>
                    <input
                      type="text"
                      placeholder="Ej: 123456"
                      value={paymentRef}
                      onChange={e => setPaymentRef(e.target.value)}
                      className="pos-input"
                      style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', marginBottom: '0.2rem', color: 'var(--text-muted)' }}>📷 Captura / Comprobante *</label>
                    <input type="file" accept="image/*" onChange={handleCaptureUpload} style={{ fontSize: '0.75rem', width: '100%', color: 'var(--text)' }} />
                    {paymentProof && <span style={{ fontSize: '0.7rem', color: 'var(--success)', display: 'block', marginTop: '0.1rem' }}>Captura adjuntada ✅</span>}
                  </div>
                </div>
              )}
              {/* Auto Print Ticket */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text)' }}>
                <input
                  type="checkbox"
                  id="autoPrintCheckbox"
                  checked={autoPrint}
                  onChange={e => setAutoPrint(e.target.checked)}
                  style={{ accentColor: 'var(--gold)', width: '14px', height: '14px', cursor: 'pointer' }}
                />
                <label htmlFor="autoPrintCheckbox" style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  🖨️ Auto-imprimir ticket al facturar
                </label>
              </div>
            </div>
          )}
        </div>
        {/* Fixed Bottom Checkout Button & General Totals */}
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>Total Final:</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--gold)' }}>{formatPriceLocal(total)}</span>
          </div>
          <button
            id="checkoutSubmitButton"
            className="btn-primary"
            onClick={handleCheckout}
            disabled={cart.length === 0 || processing || isMixedPaymentInvalid}
            style={{
              width: '100%',
              padding: '0.8rem',
              fontSize: '1rem',
              fontWeight: 'bold',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(212,175,55,0.15)'
            }}
          >
            {processing ? 'Procesando...' : activeOrderId ? 'COMPLETAR PEDIDO ONLINE' : 'COMPLETAR VENTA (Enter)'}
          </button>
          {/* Numpad render inside right column if active */}
          {activeNumpadField && (
            <div style={{ marginTop: '0.5rem' }}>
              {renderNumpad()}
            </div>
          )}
          {/* Share & Print for completed sales */}
          {lastOrder && (
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem' }}>
              <button onClick={printReceipt} style={{ flex: 1, padding: '0.6rem', background: 'var(--bg3)', border: '1px solid var(--gold)', color: 'var(--gold)', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.78rem' }}>
                🖨️ Ticket
              </button>
              <button onClick={shareOnWhatsApp} style={{ flex: 1, padding: '0.6rem', background: '#25D366', border: 'none', color: '#000', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                💬 WhatsApp
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);
  const handlePwaInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted PWA installation');
    }
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };
  const fetchSettings = async () => {
    try {
      const res = await fetchWithAuth('/api/settings');
      const data = (await res.json()) as any;
      if (data.success && data.settings) {
        setSettings(data.settings);
        localStorage.setItem('rexermi_pos_offline_settings', JSON.stringify(data.settings));
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
      const cached = localStorage.getItem('rexermi_pos_offline_settings');
      if (cached) {
        setSettings(JSON.parse(cached));
      }
    }
  };
  const fetchPaymentMethods = async () => {
    try {
      const res = await fetchWithAuth('/api/payment-methods');
      const data = (await res.json()) as any;
      if (data.success && data.paymentMethods) {
        setPaymentMethods(data.paymentMethods);
        localStorage.setItem('rexermi_pos_offline_pms', JSON.stringify(data.paymentMethods));
        if (data.paymentMethods.length > 0) {
          setPaymentMethod(String(data.paymentMethods[0].id));
        }
      }
    } catch (err) {
      console.error('Error fetching payment methods:', err);
      const cached = localStorage.getItem('rexermi_pos_offline_pms');
      if (cached) {
        setPaymentMethods(JSON.parse(cached));
        const pms = JSON.parse(cached);
        if (pms.length > 0) {
          setPaymentMethod(String(pms[0].id));
        }
      }
    } finally {
      setLoadingPMs(false);
    }
  };
  const fetchActiveClosure = async () => {
    try {
      const res = await fetchWithAuth('/api/vendedor/cash-closures');
      const data = (await res.json()) as any;
      if (data.success) {
        setActiveClosure(data.activeClosure);
        if (data.activeClosure) {
          localStorage.setItem('rexermi_pos_offline_closure', JSON.stringify(data.activeClosure));
        } else {
          localStorage.removeItem('rexermi_pos_offline_closure');
          setShowClosureModal(true);
        }
      }
    } catch (err) {
      console.error('Error checking active closure:', err);
      const cached = localStorage.getItem('rexermi_pos_offline_closure');
      if (cached) {
        setActiveClosure(JSON.parse(cached));
      }
    }
  };
  const handleOpenClosure = async () => {
    if (!isOnline) {
      showToast('No se puede iniciar turno/abrir caja en modo sin conexión.', 'error');
      return;
    }
    if (!openingAmount || isNaN(Number(openingAmount)) || Number(openingAmount) < 0) {
      showToast('Por favor introduce un monto de apertura válido.', 'error');
      return;
    }
    try {
      const res = await fetchWithAuth('/api/vendedor/cash-closures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opening_amount: Number(openingAmount),
          notes: closureNotes
        })
      });
      const data = (await res.json()) as any;
      if (data.success) {
        showToast('Caja abierta. Turno iniciado.', 'success');
        setShowClosureModal(false);
        fetchActiveClosure();
      } else {
        showToast(data.error || 'Error al abrir caja.', 'error');
      }
    } catch {
      showToast('Error de red al abrir caja.', 'error');
    }
  };
  const handleCloseClosure = async () => {
    if (!isOnline) {
      showToast('No se puede cerrar turno/caja en modo sin conexión.', 'error');
      return;
    }
    if (!actualCashAmount || isNaN(Number(actualCashAmount)) || Number(actualCashAmount) < 0) {
      showToast('Por favor introduce el monto contado real de caja.', 'error');
      return;
    }
    try {
      const res = await fetchWithAuth('/api/vendedor/cash-closures', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actual_amount: Number(actualCashAmount),
          notes: closeNotes
        })
      });
      const data = (await res.json()) as any;
      if (data.success) {
        const diff = data.closure.discrepancy;
        let diffMsg = `Cierre exitoso. `;
        if (diff === 0) diffMsg += 'Caja cuadrada perfectamente.';
        else if (diff < 0) diffMsg += `Déficit en caja: $${Math.abs(diff).toFixed(2)}`;
        else diffMsg += `Sobran en caja: $${diff.toFixed(2)}`;
        showToast(diffMsg, diff === 0 ? 'success' : diff < 0 ? 'error' : 'info');
        const closureObj = {
          ...activeClosure,
          ...data.closure,
          discrepancy: diff,
          notes: closeNotes || activeClosure.notes
        };
        if (confirm('¿Desea imprimir el ticket de cierre de caja para este turno?')) {
          setPrintType('closure');
          setLastClosureForPrint(closureObj);
        }
        setShowCloseShiftModal(false);
        setActiveClosure(null);
        localStorage.removeItem('rexermi_pos_offline_closure');
        setActualCashAmount('');
        setCloseNotes('');
        setShowClosureModal(true); // require opening a new shift immediately
      } else {
        showToast(data.error || 'Error al cerrar caja.', 'error');
      }
    } catch {
      showToast('Error de red al cerrar caja.', 'error');
    }
  };
  const fetchProducts = async () => {
    try {
      const res = await fetchWithAuth('/api/products?activeOnly=true&limit=100');
      const data = (await res.json()) as any;
      const prodList = data.products || [];
      setProducts(prodList);
      localStorage.setItem('rexermi_pos_offline_products', JSON.stringify(prodList));
    } catch (err) {
      console.error('Error fetching products:', err);
      const cached = localStorage.getItem('rexermi_pos_offline_products');
      if (cached) {
        setProducts(JSON.parse(cached));
        showToast('Catálogo local cargado (Modo Offline).', 'info');
      } else {
        showToast('Error cargando productos. No hay catálogo local guardado.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };
  const fetchCompletedOrders = async () => {
    setLoadingRecent(true);
    try {
      const res = await fetchWithAuth('/api/vendedor/orders?completed=true');
      const data = (await res.json()) as any;
      if (data.success) {
        setCompletedOrders(data.orders || []);
      }
    } catch (err) {
      console.error('Error fetching completed orders:', err);
    } finally {
      setLoadingRecent(false);
    }
  };
  const fetchOrders = async () => {
    try {
      const res = await fetchWithAuth('/api/vendedor/orders');
      const data = (await res.json()) as any;
      if (data.success) setPendingOrders(data.orders);
    } catch {
      console.error('Error fetching orders');
    }
  };
  // Sync offline orders helper
  const syncOfflineOrders = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!window.navigator.onLine) return;
    
    const queueStr = localStorage.getItem('rexermi_pos_offline_orders_queue');
    if (!queueStr) {
      setOfflineQueueLength(0);
      return;
    }
    const queue = JSON.parse(queueStr);
    if (queue.length === 0) {
      setOfflineQueueLength(0);
      return;
    }
    
    if (isSyncing) return;
    setIsSyncing(true);
    showToast(`Sincronizando ${queue.length} venta(s) pendiente(s)... ⏳`, 'info');
    
    const failed: any[] = [];
    let successCount = 0;
    
    for (const order of queue) {
      try {
        const res = await fetch('/api/vendedor/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(order.payload)
        });
        
        const data = (await res.json()) as any;
        if (res.ok) {
          successCount++;
        } else {
          console.error('Sync failure for order:', order.orderNumber, data.error);
          failed.push({ ...order, error: data.error || 'Error de validación' });
        }
      } catch (err) {
        console.error('Network error during sync of order:', order.orderNumber, err);
        const remaining = queue.slice(queue.indexOf(order));
        localStorage.setItem('rexermi_pos_offline_orders_queue', JSON.stringify(remaining.concat(failed)));
        setOfflineQueueLength(remaining.length + failed.length);
        setIsSyncing(false);
        showToast('Error de red en sincronización. Se reintentará.', 'error');
        return;
      }
    }
    
    if (successCount > 0) {
      showToast(`Sincronización completa: ${successCount} venta(s) enviada(s) al servidor. 🚀`, 'success');
      triggerHaptic('success');
      fetchProducts();
      fetchActiveClosure();
    }
    
    if (failed.length > 0) {
      showToast(`${failed.length} venta(s) no pudieron sincronizarse debido a errores de validación.`, 'error');
      localStorage.setItem('rexermi_pos_failed_orders', JSON.stringify(failed));
    } else {
      localStorage.removeItem('rexermi_pos_failed_orders');
    }
    
    localStorage.setItem('rexermi_pos_offline_orders_queue', '[]');
    setOfflineQueueLength(0);
    setIsSyncing(false);
  }, [isSyncing]);
  // Load Settings and LocalStorage Session
  useEffect(() => {
    // Monitor online/offline status
    if (typeof window !== 'undefined') {
      setIsOnline(window.navigator.onLine);
      const handleOnline = () => {
        setIsOnline(true);
        showToast('Conexión restablecida. 🟢', 'success');
      };
      const handleOffline = () => {
        setIsOnline(false);
        showToast('Sin conexión de red. Modo offline activo. 🔴', 'info');
      };
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      
      // Initial offline queue length check
      const queueStr = localStorage.getItem('rexermi_pos_offline_orders_queue');
      if (queueStr) {
        setOfflineQueueLength(JSON.parse(queueStr).length);
      }
    }
    const loadAllData = async () => {
      try {
        await Promise.all([
          fetchCurrentCashier(),
          fetchSettings(),
          fetchProducts(),
          fetchOrders(),
          fetchPaymentMethods(),
          fetchActiveClosure(),
          fetchCompletedOrders(),
        ]);
      } catch (err) {
        console.error("Error in parallel loadAllData:", err);
      }
    };
    loadAllData();
    // Load persistent POS cart and customer
    try {
      const savedCart = localStorage.getItem('rexermi_pos_cart');
      if (savedCart) setCart(JSON.parse(savedCart));
      const savedCustomer = localStorage.getItem('rexermi_pos_customer');
      if (savedCustomer) setSelectedCustomer(JSON.parse(savedCustomer));
      const savedOrderId = localStorage.getItem('rexermi_pos_order_id');
      if (savedOrderId) setActiveOrderId(JSON.parse(savedOrderId));
      const savedOriginalItems = localStorage.getItem('rexermi_pos_original_items');
      if (savedOriginalItems) setOriginalOrderItems(JSON.parse(savedOriginalItems));
      const savedSuspended = localStorage.getItem('rexermi_pos_suspended_carts');
      if (savedSuspended) setSuspendedCarts(JSON.parse(savedSuspended));
    } catch (e) {
      console.error('Failed to load local storage POS state:', e);
    }
  }, []);
  // Trigger sync on reconnection or periodically
  useEffect(() => {
    if (isOnline && offlineQueueLength > 0 && !isSyncing) {
      syncOfflineOrders();
    }
  }, [isOnline, offlineQueueLength, isSyncing, syncOfflineOrders]);
  useEffect(() => {
    if (!isOnline) return;
    const interval = setInterval(() => {
      const queueStr = localStorage.getItem('rexermi_pos_offline_orders_queue');
      if (queueStr && JSON.parse(queueStr).length > 0) {
        syncOfflineOrders();
      }
    }, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [isOnline, syncOfflineOrders]);
  // Real-time stock updates listener for POS
  useEffect(() => {
    if (!isOnline) return;
    const eventSource = new EventSource('/api/stock-sse');
    const onStockUpdate = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const { productId, stock } = data;
        
        // Update product catalog list stock
        setProducts((prevProducts) =>
          prevProducts.map((p) => (p.id === productId ? { ...p, stock } : p))
        );
        // Also update stock property of items in the cart to prevent oversales
        setCart((prevCart) =>
          prevCart.map((item) => (item.id === productId ? { ...item, stock } : item))
        );
      } catch (err) {
        console.error('Error parsing POS stock update event:', err);
      }
    };
    eventSource.addEventListener('stock_update', onStockUpdate);
    eventSource.onerror = (err) => {
      console.error('EventSource connection error on POS:', err);
    };
    return () => {
      eventSource.removeEventListener('stock_update', onStockUpdate);
      eventSource.close();
    };
  }, []);
  // Save POS Session State to LocalStorage in a single observer
  useEffect(() => {
    try {
      if (cart.length > 0) {
        localStorage.setItem('rexermi_pos_cart', JSON.stringify(cart));
      } else {
        localStorage.removeItem('rexermi_pos_cart');
      }
      if (selectedCustomer) {
        localStorage.setItem('rexermi_pos_customer', JSON.stringify(selectedCustomer));
      } else {
        localStorage.removeItem('rexermi_pos_customer');
      }
      if (activeOrderId) {
        localStorage.setItem('rexermi_pos_order_id', JSON.stringify(activeOrderId));
      } else {
        localStorage.removeItem('rexermi_pos_order_id');
      }
      if (originalOrderItems.length > 0) {
        localStorage.setItem('rexermi_pos_original_items', JSON.stringify(originalOrderItems));
      } else {
        localStorage.removeItem('rexermi_pos_original_items');
      }
    } catch (e) {
      console.error('Failed to save POS state to localStorage:', e);
    }
  }, [cart, selectedCustomer, activeOrderId, originalOrderItems]);
  // Permanent Focus & Aggressive Autofocus for POS search input
  useEffect(() => {
    if (tab !== 'pos' || showClosureModal || showCloseShiftModal || showCustomerForm || isCatalogModalOpen || isSuspendedModalOpen || isGenericModalOpen || isAbonoModalOpen || isRecentSalesOpen || isQuickSwitchOpen || isShortcutsHelpOpen) return;
    const handleFocusBack = () => {
      setTimeout(() => {
        const active = document.activeElement;
        const isInput = active && (
          active.tagName === 'INPUT' || 
          active.tagName === 'TEXTAREA' || 
          active.tagName === 'SELECT' || 
          active.hasAttribute('contenteditable')
        );
        if (!isInput && searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
    };
    const handleKeyDownCapture = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const isInput = active && (
        active.tagName === 'INPUT' || 
        active.tagName === 'TEXTAREA' || 
        active.tagName === 'SELECT' || 
        active.hasAttribute('contenteditable')
      );
      if (!isInput && searchInputRef.current) {
        // Focus only for actual printable keys or backspace/enter to not conflict with F-keys or Alt
        if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace') {
          searchInputRef.current.focus();
        }
      }
    };
    document.addEventListener('click', handleFocusBack);
    document.addEventListener('focusin', handleFocusBack);
    window.addEventListener('keydown', handleKeyDownCapture);
    
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
    // Periodic check to enforce focus when idle
    const interval = setInterval(() => {
      const active = document.activeElement;
      const isInput = active && (
        active.tagName === 'INPUT' || 
        active.tagName === 'TEXTAREA' || 
        active.tagName === 'SELECT' || 
        active.hasAttribute('contenteditable')
      );
      if (!isInput && searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 1500);
    return () => {
      document.removeEventListener('click', handleFocusBack);
      document.removeEventListener('focusin', handleFocusBack);
      window.removeEventListener('keydown', handleKeyDownCapture);
      clearInterval(interval);
    };
  }, [tab, showClosureModal, showCloseShiftModal, showCustomerForm, isCatalogModalOpen, isSuspendedModalOpen, isGenericModalOpen, isAbonoModalOpen, isRecentSalesOpen, isQuickSwitchOpen, isShortcutsHelpOpen]);
  // Trigger Auto-Print when a new sale or closure is completed
  useEffect(() => {
    if (lastOrder && autoPrint && printType === 'order') {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [lastOrder, autoPrint, printType]);
  useEffect(() => {
    if (lastClosureForPrint && printType === 'closure') {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [lastClosureForPrint, printType]);
  // Audio feedback helper using Web Audio API
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
      console.warn('Audio feedback blocked or failed:', err);
    }
  };
  // Barcode exact search handler
  const lookupBarcode = async (rawCode: string) => {
    if (!rawCode) return;
    let code = rawCode;
    let qty = 1;
    if (rawCode.includes('*')) {
      const parts = rawCode.split('*');
      const parsedQty = parseInt(parts[0], 10);
      const barcodePart = parts.slice(1).join('*').trim();
      if (!isNaN(parsedQty) && parsedQty > 0 && barcodePart) {
        qty = parsedQty;
        code = barcodePart;
      }
    }
    // Try local match first (faster, no network)
    const localMatch = products.find(p => p.barcode === code);
    if (localMatch) {
      addToCart(localMatch, qty);
      setSearch('');
      return;
    }
    // Fallback to API for exact barcode lookup (if online)
    if (!isOnline) {
      // Try adding by name match as last resort offline
      const nameMatch = products.find(p => p.name.toLowerCase() === code.toLowerCase());
      if (nameMatch) {
        addToCart(nameMatch, qty);
      } else {
        showToast('Producto no encontrado en catálogo local offline.', 'error');
        playBeep('error');
      }
      setSearch('');
      return;
    }
    try {
      const res = await fetchWithAuth(`/api/vendedor/products?barcode=${encodeURIComponent(code)}`);
      if (res.ok) {
        const product = (await res.json()) as any;
        if (product && product.id) {
          addToCart(product, qty);
        } else {
          // Try adding by name match as last resort
          const nameMatch = products.find(p => p.name.toLowerCase() === code.toLowerCase());
          if (nameMatch) {
            addToCart(nameMatch, qty);
          } else {
            showToast('Producto no encontrado', 'error');
            playBeep('error');
          }
        }
      } else {
        // Try adding by name match as last resort
        const nameMatch = products.find(p => p.name.toLowerCase() === code.toLowerCase());
        if (nameMatch) {
          addToCart(nameMatch, qty);
        } else {
          showToast('Producto no encontrado o inactivo', 'error');
          playBeep('error');
        }
      }
    } catch (err) {
      console.error('Error scanning barcode:', err);
      showToast('Error de red al escanear producto', 'error');
      playBeep('error');
    } finally {
      setSearch('');
    }
  };
  const handleBarcodeSearch = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await lookupBarcode(search.trim());
    }
  };
  const selectedPM = paymentMethods.find(pm => String(pm.id) === String(paymentMethod));
  const requiresProof = selectedPM ? selectedPM.requires_proof : false;
  const filteredProducts = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return products;
    return products.filter(p => 
      p.name.toLowerCase().includes(s) || 
      p.id.toString().includes(s) ||
      (p.barcode && p.barcode.toLowerCase().includes(s))
    );
  }, [products, search]);
  // Reset virtual scroll when filters/search changes
  useEffect(() => {
    setVisibleCount(80);
  }, [search]);
  // Virtual catalog infinite scroll IntersectionObserver
  useEffect(() => {
    const el = observerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => Math.min(prev + 40, filteredProducts.length));
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.unobserve(el);
  }, [filteredProducts.length, visibleCount]);
  // Get similar products when out of stock
  const suggestedProducts = useMemo(() => {
    if (!stockAlertProduct) return [];
    return products.filter(p => 
      p.category_id === stockAlertProduct.category_id && 
      p.id !== stockAlertProduct.id && 
      p.stock > 0
    ).slice(0, 5);
  }, [stockAlertProduct, products]);
  const addToCart = useCallback((product: Product, quantity: number = 1) => {
    const existing = cart.find(item => item.id === product.id);
    let availableStock = product.stock;
    if (product.type === 'product') {
      if (existing) {
        if (existing.cartQuantity + quantity > availableStock) {
          showToast(`Stock insuficiente para ${product.name} (Disponibles: ${availableStock - existing.cartQuantity})`, 'error');
          playBeep('error');
          triggerHaptic('warning');
          return;
        }
      } else {
        if (availableStock < quantity) {
          showToast(`Stock insuficiente para ${product.name} (Disponible: ${availableStock})`, 'error');
          playBeep('error');
          triggerHaptic('warning');
          if (availableStock === 0) {
            setStockAlertProduct(product);
          }
          return;
        }
      }
    }
    setCart(prev => {
      const exists = prev.find(item => item.id === product.id);
      if (exists) {
        return prev.map(item => item.id === product.id ? { ...item, cartQuantity: item.cartQuantity + quantity } : item);
      }
      return [...prev, { ...product, cartQuantity: quantity }];
    });
    const msg = existing 
      ? (quantity > 1 ? `Agregadas ${quantity} unidades de ${product.name}` : `Cantidad incrementada para ${product.name}`)
      : `Agregado al carrito: ${product.name}`;
    showToast(msg, 'success');
    playBeep('success');
    triggerHaptic('light');
  }, [cart, showToast]);
  const updateCartItemQuantity = useCallback((itemId: number, newQty: number, maxStock: number, isService: boolean) => {
    if (newQty <= 0) {
      const item = cart.find(c => c.id === itemId);
      if (item) {
        setCart(prev => prev.filter(c => c.id !== itemId));
        showToast(`Removido: ${item.name}`, 'info');
        triggerHaptic('medium');
      }
      return;
    }
    if (!isService && newQty > maxStock) {
      showToast('No hay suficiente stock en inventario.', 'error');
      triggerHaptic('warning');
      return;
    }
    const item = cart.find(c => c.id === itemId);
    if (item) {
      const oldQty = item.cartQuantity;
      const msg = newQty > oldQty ? `Cantidad incrementada para ${item.name}` : `Cantidad reducida para ${item.name}`;
      setCart(prev => prev.map(c => c.id === itemId ? { ...c, cartQuantity: newQty } : c));
      showToast(msg, 'success');
      triggerHaptic('light');
    }
  }, [cart, showToast]);
  // Suspended Carts Handlers
  const handleSuspendCart = () => {
    if (cart.length === 0) return;
    triggerHaptic('medium');
    const label = prompt('Ingrese una nota o nombre para identificar esta venta en espera (opcional):') || '';
    const nameDisplay = label.trim() ? `"${label.trim()}"` : `Venta #${suspendedCarts.length + 1}`;
    const timestamp = new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
    const newSuspendedCart = {
      id: `SUSP-${Date.now()}`,
      name: `${nameDisplay} (${timestamp})`,
      cart: [...cart],
      selectedCustomer,
      discountAmount,
      discountType,
      paymentMethod,
      activeOrderId,
      originalOrderItems
    };
    const updatedCarts = [...suspendedCarts, newSuspendedCart];
    setSuspendedCarts(updatedCarts);
    localStorage.setItem('rexermi_pos_suspended_carts', JSON.stringify(updatedCarts));
    // Clear active cart state
    setCart([]);
    setMobileStep('cart');
    setSelectedCustomer(null);
    setDiscountAmount('');
    setAmountReceived('');
    setActiveOrderId(null);
    setOriginalOrderItems([]);
    setMixedPayments({});
    setMixedReferences({});
    showToast('Venta suspendida y guardada en espera. ⏸️', 'info');
  };
  const handleClearCart = useCallback(() => {
    if (cart.length === 0) return;
    if (window.confirm('¿Está seguro de vaciar el carrito actual?')) {
      triggerHaptic('medium');
      setCart([]);
      setMobileStep('cart');
      setSelectedCustomer(null);
      setCustomerSearchDoc('');
      setPaymentProof(null);
      setPaymentRef('');
      setDiscountAmount('');
      setAmountReceived('');
      setActiveOrderId(null);
      setOriginalOrderItems([]);
      setMixedPayments({});
      setMixedReferences({});
      localStorage.removeItem('rexermi_pos_cart');
      localStorage.removeItem('rexermi_pos_customer');
      localStorage.removeItem('rexermi_pos_order_id');
      localStorage.removeItem('rexermi_pos_original_items');
      showToast('Carrito vaciado.', 'info');
    }
  }, [cart, showToast]);
  const handleRestoreSuspendedCart = (suspendedItem: any) => {
    triggerHaptic('medium');
    
    if (cart.length > 0) {
      if (!confirm('Tu carrito actual no está vacío. ¿Deseas reemplazarlo con la venta en espera?')) {
        return;
      }
    }
    setCart(suspendedItem.cart);
    setSelectedCustomer(suspendedItem.selectedCustomer || null);
    setDiscountAmount(suspendedItem.discountAmount || '');
    if (suspendedItem.discountType) setDiscountType(suspendedItem.discountType);
    setPaymentMethod(suspendedItem.paymentMethod || '');
    setActiveOrderId(suspendedItem.activeOrderId || null);
    setOriginalOrderItems(suspendedItem.originalOrderItems || []);
    
    // Remove from suspended list
    const updatedCarts = suspendedCarts.filter(c => c.id !== suspendedItem.id);
    setSuspendedCarts(updatedCarts);
    localStorage.setItem('rexermi_pos_suspended_carts', JSON.stringify(updatedCarts));
    setIsSuspendedModalOpen(false);
    showToast('Venta en espera restaurada. ⚡', 'success');
  };
  const handleRemoveSuspendedCart = (id: string) => {
    triggerHaptic('medium');
    if (!confirm('¿Seguro de eliminar esta venta en espera?')) return;
    const updatedCarts = suspendedCarts.filter(c => c.id !== id);
    setSuspendedCarts(updatedCarts);
    localStorage.setItem('rexermi_pos_suspended_carts', JSON.stringify(updatedCarts));
    showToast('Venta en espera eliminada.', 'info');
  };
  // Keyboard Shortcuts Integration
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const isInput = active && (
        active.tagName === 'INPUT' || 
        active.tagName === 'TEXTAREA' || 
        active.tagName === 'SELECT' || 
        active.hasAttribute('contenteditable')
      );
      // F1 or Alt+H or '?' (if not typing) -> Toggle Shortcuts Help
      if (e.key === 'F1' || (e.key === '?' && !isInput)) {
        e.preventDefault();
        setIsShortcutsHelpOpen(prev => !prev);
      }
      // F2 or Alt+S -> Open/toggle catalog modal
      if (e.key === 'F2' || (e.altKey && e.key.toLowerCase() === 's')) {
        e.preventDefault();
        setIsCatalogModalOpen(prev => !prev);
      }
      // F3 or Alt+G -> Toggle Generic Item Modal
      if (e.key === 'F3' || (e.altKey && e.key.toLowerCase() === 'g')) {
        e.preventDefault();
        setIsGenericModalOpen(prev => !prev);
      }
      // F4 -> Switch to Step 1 (Cliente)
      if (e.key === 'F4') {
        e.preventDefault();
        setCheckoutStep('customer');
        setMobileStep('customer');
      }
      // F5 -> Switch to Step 2 (Pago)
      if (e.key === 'F5') {
        e.preventDefault();
        setCheckoutStep('payment');
        setMobileStep('payment');
      }
      // Alt+W -> Suspend current cart
      if (e.altKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        handleSuspendCart();
      }
      // Enter -> If in payment amount received or not in input, submit checkout
      if (e.key === 'Enter') {
        const isReceivedInput = active && active.id === 'amountReceivedInput';
        if (!isInput || isReceivedInput) {
          e.preventDefault();
          const checkoutBtn = document.getElementById('checkoutSubmitButton') as HTMLButtonElement;
          if (checkoutBtn && !checkoutBtn.disabled) {
            checkoutBtn.click();
          }
        }
      }
      // F6 or Alt+D -> Toggle currency USD / VES
      if (e.key === 'F6' || (e.altKey && e.key.toLowerCase() === 'd')) {
        e.preventDefault();
        setCurrency(currency === 'USD' ? 'VES' : 'USD');
      }
      // F7 or Alt+E -> Toggle Suspended Carts modal
      if (e.key === 'F7' || (e.altKey && e.key.toLowerCase() === 'e')) {
        e.preventDefault();
        setIsSuspendedModalOpen(prev => !prev);
      }
      // F8 or Alt+M -> Focus payment select
      if (e.key === 'F8' || (e.altKey && e.key.toLowerCase() === 'm')) {
        e.preventDefault();
        const paymentSelect = document.getElementById('paymentMethodSelect') as any;
        if (paymentSelect) paymentSelect.focus();
      }
      // F9 or Alt+C -> Focus customer search
      if (e.key === 'F9' || (e.altKey && e.key.toLowerCase() === 'c')) {
        e.preventDefault();
        const customerSearchInput = document.getElementById('customerSearchInput') as any;
        if (customerSearchInput) customerSearchInput.focus();
      }
      // F10 or Alt+P -> Process sale / Checkout Submit
      if (e.key === 'F10' || (e.altKey && e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        const checkoutBtn = document.getElementById('checkoutSubmitButton') as any;
        if (checkoutBtn && !checkoutBtn.disabled) checkoutBtn.click();
      }
      // Alt+K -> Quick switch cashier modal
      if (e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsQuickSwitchOpen(prev => !prev);
      }
      // ESC or Alt+X (if not typing) -> Clear/Empty cart
      if ((e.key === 'Escape' && !isInput) || (e.altKey && e.key.toLowerCase() === 'x')) {
        e.preventDefault();
        handleClearCart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    cart, 
    currency,
    handleSuspendCart, 
    handleClearCart, 
    setCurrency, 
    setIsShortcutsHelpOpen, 
    setIsGenericModalOpen, 
    setIsSuspendedModalOpen, 
    setIsQuickSwitchOpen
  ]);
  const fetchCurrentCashier = async () => {
    try {
      const res = await fetchWithAuth('/api/auth/me');
      const data = (await res.json()) as any;
      if (res.ok && data.user) {
        setCurrentCashier(data.user);
      }
    } catch (err) {
      console.error('Error fetching current cashier:', err);
    }
  };
  const handleRegisterAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    
    const amountVal = parseFloat(abonoAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      showToast('El monto del abono debe ser mayor a cero.', 'error');
      return;
    }
    
    setProcessingAbono(true);
    try {
      const res = await fetchWithAuth('/api/vendedor/customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          amount: amountVal,
          paymentMethod: abonoPaymentMethod,
          reference: abonoReference.trim()
        })
      });
      const data = (await res.json()) as any;
      if (res.ok && data.success) {
        showToast(`💵 Abono de $${amountVal.toFixed(2)} registrado exitosamente.`, 'success');
        
        // Refresh customer details in current selection
        setSelectedCustomer(prev => {
          if (!prev) return null;
          return {
            ...prev,
            credit_used: data.result.newDebt,
            loyalty_points: data.result.newPoints,
            credit_limit: data.result.newLimit
          };
        });
        // Trigger printer for payment receipt
        const abonoPrintData = {
          orderNumber: `ABONO-${Date.now().toString().slice(-6)}`,
          date: new Date().toLocaleString(),
          customer: { full_name: selectedCustomer.full_name, id_document: selectedCustomer.id_document },
          paymentMethod: abonoPaymentMethod,
          items: [{
            id: 0,
            name: `Abono a línea de crédito (${abonoReference.trim() || 'Abono POS'})`,
            price: amountVal,
            cartQuantity: 1,
            type: 'service'
          }],
          discount: 0,
          total: amountVal
        };
        setPrintType('order');
        setLastOrder(abonoPrintData);
        setTimeout(() => {
          window.print();
        }, 250);
        // Reset state & close modal
        setAbonoAmount('');
        setAbonoReference('');
        setIsAbonoModalOpen(false);
        
        // Refresh closures to update expected amounts
        fetchActiveClosure();
      } else {
        showToast(data.error || 'Error al procesar el abono.', 'error');
      }
    } catch {
      showToast('Error de red al procesar el abono.', 'error');
    } finally {
      setProcessingAbono(false);
    }
  };
  const handleQuickSwitch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickSwitchPin || quickSwitchPin.trim() === '') return;
    try {
      const res = await fetchWithAuth('/api/vendedor/quick-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'switch', pin: quickSwitchPin })
      });
      const data = (await res.json()) as any;
      if (res.ok && data.success) {
        showToast(`👤 Bienvenido, ${data.user.fullName} 👋`, 'success');
        setCurrentCashier(data.user);
        setActiveClosure(data.activeClosure);
        
        if (data.activeClosure) {
          localStorage.setItem('rexermi_pos_offline_closure', JSON.stringify(data.activeClosure));
        } else {
          localStorage.removeItem('rexermi_pos_offline_closure');
          setShowClosureModal(true);
        }
        // Reset switcher & close modal
        setQuickSwitchPin('');
        setIsQuickSwitchOpen(false);
        // Fetch new seller completed sales
        fetchCompletedOrders();
        fetchOrders();
      } else {
        showToast(data.error || 'PIN inválido o sin acceso al POS.', 'error');
        setQuickSwitchPin('');
      }
    } catch {
      showToast('Error de red al cambiar de cajero.', 'error');
    }
  };
  const handleConfigurePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinSettingPassword || !pinSettingNewPin) return;
    try {
      const res = await fetchWithAuth('/api/vendedor/quick-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'set_pin', 
          password: pinSettingPassword, 
          pin: pinSettingNewPin 
        })
      });
      const data = (await res.json()) as any;
      if (res.ok && data.success) {
        showToast('🔑 PIN de cajero configurado exitosamente.', 'success');
        setPinSettingPassword('');
        setPinSettingNewPin('');
        setIsConfiguringPin(false);
      } else {
        showToast(data.error || 'Error al configurar el PIN.', 'error');
      }
    } catch {
      showToast('Error de red al configurar el PIN.', 'error');
    }
  };
  // Generic Product Handler
  const handleAddGenericProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const priceVal = parseFloat(genericPrice);
    const qtyVal = parseInt(genericQty, 10);
    
    if (!genericName.trim()) return showToast('El nombre es obligatorio.', 'error');
    if (isNaN(priceVal) || priceVal < 0) return showToast('Precio inválido.', 'error');
    if (isNaN(qtyVal) || qtyVal <= 0) return showToast('Cantidad inválida.', 'error');
    const genericProduct: Product = {
      id: -Date.now(),
      name: genericName.trim(),
      price: priceVal,
      stock: 999999,
      type: 'service'
    };
    addToCart(genericProduct, qtyVal);
    
    // Reset states
    setGenericName('Artículo Genérico');
    setGenericPrice('1.0');
    setGenericQty('1');
    setIsGenericModalOpen(false);
  };
  const handleCustomerSearchChange = (val: string) => {
    setCustomerSearchDoc(val);
  };
  // Debounced search for customers
  useEffect(() => {
    if (customerSearchDoc.length < 2) {
      setCustomerSearchResults([]);
      setShowCustomerForm(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetchWithAuth(`/api/vendedor/customers?doc=${encodeURIComponent(customerSearchDoc)}`);
        const data = (await res.json()) as any;
        if (data.success && data.customers.length > 0) {
          setCustomerSearchResults(data.customers);
          setShowCustomerForm(false);
        } else {
          setCustomerSearchResults([]);
          // Initialize form fields intelligently
          const term = customerSearchDoc.trim();
          if (/^\d+$/.test(term)) {
            setNewCustomerDoc(term);
            setNewCustomerName('');
          } else {
            setNewCustomerDoc('');
            setNewCustomerName(term);
          }
          setNewCustomerPhone('');
          setNewCustomerEmail('');
          setShowCustomerForm(true);
        }
      } catch (err) {
        console.error('Error fetching customers:', err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearchDoc]);
  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearchDoc('');
    setCustomerSearchResults([]);
    setShowCustomerForm(false);
    showToast(`Cliente seleccionado: ${customer.full_name}`, 'success');
  };
  const searchCustomerManual = async () => {
    if (!customerSearchDoc) return;
    try {
      const res = await fetchWithAuth(`/api/vendedor/customers?doc=${encodeURIComponent(customerSearchDoc)}`);
      const data = (await res.json()) as any;
      if (data.success && data.customers.length > 0) {
        selectCustomer(data.customers[0]);
      } else {
        showToast('Cliente no encontrado. Puedes registrarlo abajo.', 'error');
        setSelectedCustomer(null);
        // Initialize form fields intelligently
        const term = customerSearchDoc.trim();
        if (/^\d+$/.test(term)) {
          setNewCustomerDoc(term);
          setNewCustomerName('');
        } else {
          setNewCustomerDoc('');
          setNewCustomerName(term);
        }
        setNewCustomerPhone('');
        setNewCustomerEmail('');
        setShowCustomerForm(true);
      }
    } catch {
      showToast('Error buscando cliente', 'error');
    }
  };
  const registerCustomer = async () => {
    if (!newCustomerName.trim()) return showToast('El nombre es obligatorio.', 'error');
    if (!newCustomerDoc.trim()) return showToast('La cédula/RIF es obligatoria.', 'error');
    if (!newCustomerPhone.trim()) return showToast('El teléfono es obligatorio.', 'error');
    
    try {
      const res = await fetchWithAuth('/api/vendedor/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: newCustomerName.trim(),
          id_document: newCustomerDoc.trim(),
          phone: newCustomerPhone.trim(),
          email: newCustomerEmail.trim() || undefined
        })
      });
      const data = (await res.json()) as any;
      if (data.success) {
        setSelectedCustomer(data.customer);
        setShowCustomerForm(false);
        setNewCustomerName('');
        setNewCustomerDoc('');
        setNewCustomerPhone('');
        setNewCustomerEmail('');
        showToast('Cliente registrado con éxito', 'success');
      } else {
        showToast(data.error || 'Error al registrar', 'error');
      }
    } catch {
      showToast('Error de red al registrar', 'error');
    }
  };
  const handleCaptureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPaymentProof(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  // Computations (useMemoized)
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.price * item.cartQuantity), 0);
  }, [cart]);
  const discountVal = useMemo(() => {
    const rawVal = parseFloat(discountAmount) || 0;
    if (discountType === 'percent') {
      return parseFloat((subtotal * rawVal / 100).toFixed(2));
    }
    return rawVal;
  }, [discountAmount, discountType, subtotal]);
  const total = useMemo(() => {
    return Math.max(0, subtotal - discountVal);
  }, [subtotal, discountVal]);
  const totalCost = useMemo(() => {
    return cart.reduce((sum, item) => sum + ((item.cost_price || 0) * item.cartQuantity), 0);
  }, [cart]);
  const profitMargin = useMemo(() => {
    if (total <= 0) return 0;
    const profit = total - totalCost;
    return (profit / total) * 100;
  }, [total, totalCost]);
  const isMixedPaymentInvalid = useMemo(() => {
    if (paymentMethod !== 'Mixto') return false;
    let assigned = 0;
    for (const [pmName, amountStr] of Object.entries(mixedPayments)) {
      const amt = parseFloat(amountStr) || 0;
      if (amt > 0) {
        assigned += amt;
        const pm = paymentMethods.find(p => p.name === pmName);
        if (pm && pm.requires_proof === 1) {
          const ref = mixedReferences[pmName];
          if (!ref || !ref.trim()) {
            return true;
          }
        }
      }
    }
    return Math.abs(assigned - total) >= 0.01;
  }, [paymentMethod, mixedPayments, paymentMethods, mixedReferences, total]);
  const handleCheckout = async () => {
    if (!cart.length) return;
    
    if (paymentMethod === 'Mixto') {
      let mixedSum = 0;
      for (const [pmName, amountStr] of Object.entries(mixedPayments)) {
        const amt = parseFloat(amountStr) || 0;
        if (amt > 0) {
          mixedSum += amt;
          const pm = paymentMethods.find(p => p.name === pmName);
          if (pm && pm.requires_proof === 1) {
            const ref = mixedReferences[pmName];
            if (!ref || !ref.trim()) {
              showToast(`La referencia de pago es requerida para el método ${pmName}.`, 'error');
              return;
            }
          }
        }
      }
      if (Math.abs(mixedSum - total) >= 0.01) {
        showToast(`La suma de los pagos mixtos (${formatPrice(mixedSum)}) no coincide con el total (${formatPrice(total)}).`, 'error');
        return;
      }
    } else if (selectedPM?.name === 'Crédito') {
      if (!selectedCustomer) {
        showToast('La venta a crédito requiere seleccionar un cliente registrado.', 'error');
        return;
      }
      if (selectedCustomer.credit_status === 'suspended' || selectedCustomer.credit_status === 'cancelled') {
        showToast(`La cuenta de crédito del cliente se encuentra suspendida o anulada (Estado: ${selectedCustomer.credit_status}).`, 'error');
        return;
      }
      const available = (selectedCustomer.credit_limit || 0) - (selectedCustomer.credit_used || 0);
      if (available < total) {
        showToast(`Crédito insuficiente. Disponible: ${formatPrice(available)}, Requerido: ${formatPrice(total)}`, 'error');
        return;
      }
    } else if (requiresProof) {
      if (!paymentRef.trim()) {
        showToast('El número de referencia es obligatorio para este método de pago.', 'error');
        return;
      }
      if (!paymentProof) {
        showToast('La captura/comprobante de pago es obligatoria para este método de pago.', 'error');
        return;
      }
    }
    
    setProcessing(true);
    if (!isOnline) {
      // Offline Flow
      try {
        const localOrderNum = `POS-OFF-${Date.now().toString().slice(-6)}`;
        const offlinePayload = {
          cart,
          paymentMethod,
          paymentRef,
          subtotal,
          customerId: selectedCustomer?.id || null,
          paymentProof,
          orderId: activeOrderId || null,
          discountAmount: discountVal,
          mixedPayments: paymentMethod === 'Mixto' ? Object.fromEntries(
            Object.entries(mixedPayments)
              .map(([k, v]): [string, number] => [k, parseFloat(v) || 0])
              .filter(([_, v]) => v > 0)
          ) : undefined,
          mixedReferences: paymentMethod === 'Mixto' ? mixedReferences : undefined
        };
        const offlineOrder = {
          localId: `OFF-${Date.now()}`,
          payload: offlinePayload,
          orderNumber: localOrderNum,
          customer: selectedCustomer,
          items: [...cart],
          total: total,
          paymentMethod: selectedPM ? selectedPM.name : (paymentMethod === 'Mixto' ? 'Mixto' : paymentMethod),
          date: new Date().toLocaleString('es-VE'),
          discount: discountVal,
          isOffline: true,
          mixedPayments: offlinePayload.mixedPayments,
          mixedReferences: offlinePayload.mixedReferences
        };
        // Queue order in localStorage
        const queue = JSON.parse(localStorage.getItem('rexermi_pos_offline_orders_queue') || '[]');
        queue.push(offlineOrder);
        localStorage.setItem('rexermi_pos_offline_orders_queue', JSON.stringify(queue));
        setOfflineQueueLength(queue.length);
        // Deduct quantities locally
        const updatedProducts = products.map(p => {
          const itemInCart = cart.find(c => c.id === p.id);
          if (itemInCart && p.type === 'product') {
            return { ...p, stock: Math.max(0, p.stock - itemInCart.cartQuantity) };
          }
          return p;
        });
        setProducts(updatedProducts);
        localStorage.setItem('rexermi_pos_offline_products', JSON.stringify(updatedProducts));
        showToast(`Venta guardada localmente (Modo Offline). Ticket: ${localOrderNum}`, 'success');
        playBeep('success');
        triggerHaptic('success');
        setPrintType('order');
        setLastOrder(offlineOrder);
        // Reset state & local storage
        setCart([]);
        setMobileStep('cart');
        setSelectedCustomer(null);
        setCustomerSearchDoc('');
        setPaymentProof(null);
        setPaymentRef('');
        setDiscountAmount('');
        setAmountReceived('');
        setActiveOrderId(null);
        setOriginalOrderItems([]);
        setMixedPayments({});
        setMixedReferences({});
        localStorage.removeItem('rexermi_pos_cart');
        localStorage.removeItem('rexermi_pos_customer');
        localStorage.removeItem('rexermi_pos_order_id');
        localStorage.removeItem('rexermi_pos_original_items');
      } catch (err: any) {
        console.error('Offline checkout error:', err);
        showToast('Error procesando venta offline.', 'error');
      } finally {
        setProcessing(false);
      }
      return;
    }
    // Online Flow (Pre-check stock in real-time)
    const productIds = cart.map(item => item.id).filter(id => id > 0).join(',');
    try {
      const stockRes = productIds ? await fetchWithAuth(`/api/products?ids=${productIds}`) : null;
      const stockData = (stockRes ? await stockRes.json() : { success: true, products: [] }) as any;
      if (stockData.success && stockData.products) {
        for (const item of cart) {
          if (item.id <= 0) continue; // Skip generic product stock checks
          if (item.type === 'service') continue;
          const freshProd = stockData.products.find((p: any) => Number(p.id) === Number(item.id));
          if (!freshProd) {
            showToast(`El producto "${item.name}" ya no está disponible.`, 'error');
            setProcessing(false);
            return;
          }
          // Adjust stock with original order items if this is an online order checkout
          let originalQty = 0;
          if (activeOrderId) {
            const originalOrder = pendingOrders.find(o => Number(o.id) === Number(activeOrderId));
            let foundInPending = false;
            if (originalOrder && originalOrder.items_json) {
              try {
                const parsedItems = typeof originalOrder.items_json === 'string' 
                  ? JSON.parse(originalOrder.items_json) 
                  : originalOrder.items_json;
                const origItem = parsedItems.find((oi: any) => Number(oi.id) === Number(item.id));
                if (origItem) {
                  originalQty = Number(origItem.quantity) || 0;
                  foundInPending = true;
                }
              } catch (e) {
                console.error("Failed to parse items_json:", e);
              }
            }
            if (!foundInPending) {
              const origItem = originalOrderItems.find(oi => Number(oi.id) === Number(item.id));
              if (origItem) {
                originalQty = Number(origItem.quantity) || 0;
              }
            }
          }
          
          const adjustedStock = Number(freshProd.stock) + originalQty;
          if (adjustedStock < Number(item.cartQuantity)) {
            showToast(`Stock insuficiente en tiempo real para "${item.name}". Disponible: ${adjustedStock}, solicitado: ${item.cartQuantity}`, 'error');
            setProducts(prev => prev.map(p => Number(p.id) === Number(item.id) ? { ...p, stock: Number(freshProd.stock) } : p));
            setProcessing(false);
            return;
          }
        }
      }
    } catch (err: any) {
      console.error('Error in stock precheck:', err);
      if (err.message === 'Unauthorized') return;
    }
    try {
      const res = await fetchWithAuth('/api/vendedor/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart,
          paymentMethod,
          paymentRef,
          subtotal,
          customerId: selectedCustomer?.id || null,
          paymentProof,
          orderId: activeOrderId || null,
          discountAmount: discountVal,
          mixedPayments: paymentMethod === 'Mixto' ? Object.fromEntries(
            Object.entries(mixedPayments)
              .map(([k, v]): [string, number] => [k, parseFloat(v) || 0])
              .filter(([_, v]) => v > 0)
          ) : undefined,
          mixedReferences: paymentMethod === 'Mixto' ? mixedReferences : undefined
        })
      });
      const data = (await res.json()) as any;
      if (res.ok) {
        showToast(activeOrderId ? `Pedido completado y facturado.` : `Venta completada. Orden: ${data.orderNumber}`, 'success');
        triggerHaptic('success');
        
        setPrintType('order');
        setLastOrder({
          orderNumber: data.orderNumber,
          customer: selectedCustomer,
          items: [...cart],
          total: total,
          paymentMethod: selectedPM ? selectedPM.name : paymentMethod,
          date: new Date().toLocaleString('es-VE'),
          discount: discountVal,
          mixedPayments: paymentMethod === 'Mixto' ? Object.fromEntries(
            Object.entries(mixedPayments)
              .map(([k, v]): [string, number] => [k, parseFloat(v) || 0])
              .filter(([_, v]) => v > 0)
          ) : undefined,
          mixedReferences: paymentMethod === 'Mixto' ? mixedReferences : undefined
        });
        
        // Reset state & local storage
        setCart([]);
        setMobileStep('cart');
        setSelectedCustomer(null);
        setCustomerSearchDoc('');
        setPaymentProof(null);
        setPaymentRef('');
        setDiscountAmount('');
        setAmountReceived('');
        setActiveOrderId(null);
        setOriginalOrderItems([]);
        setMixedPayments({});
        setMixedReferences({});
        
        localStorage.removeItem('rexermi_pos_cart');
        localStorage.removeItem('rexermi_pos_customer');
        localStorage.removeItem('rexermi_pos_order_id');
        localStorage.removeItem('rexermi_pos_original_items');
        fetchProducts(); // Refresh stock
        fetchOrders(); // Refresh pending online orders
        fetchActiveClosure(); // Refresh active closure expected amounts
        fetchCompletedOrders(); // Refresh recent completed orders
      } else {
        showToast(data.error || 'Error al procesar la venta', 'error');
      }
    } catch {
      showToast('Error de red', 'error');
    } finally {
      setProcessing(false);
    }
  };
  // Direct Operations on Pending Orders
  const handleDirectCompleteOrder = async (orderId: number) => {
    if (!confirm('¿Desea completar este pedido en mostrador directamente?')) return;
    try {
      const res = await fetchWithAuth('/api/vendedor/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, status: 'delivered' })
      });
      const data = (await res.json()) as any;
      if (res.ok) {
        showToast('✅ Pedido completado directamente.', 'success');
        fetchOrders();
      } else {
        showToast(data.error || 'Error al completar pedido.', 'error');
      }
    } catch {
      showToast('Error de red al completar pedido.', 'error');
    }
  };
  const handleCancelOrder = async (orderId: number) => {
    if (!confirm('¿Está seguro de cancelar este pedido? Se restaurará el stock correspondiente.')) return;
    try {
      const res = await fetchWithAuth('/api/vendedor/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, status: 'cancelled' })
      });
      const data = (await res.json()) as any;
      if (res.ok) {
        showToast('🗑️ Pedido cancelado y stock devuelto.', 'success');
        fetchOrders();
        fetchProducts();
      } else {
        showToast(data.error || 'Error al cancelar pedido.', 'error');
      }
    } catch {
      showToast('Error de red al cancelar pedido.', 'error');
    }
  };
  const handleLoadOrderIntoPOS = (order: Order) => {
    try {
      const items = order.items_json ? JSON.parse(order.items_json) : [];
      if (!items.length) {
        showToast('El pedido seleccionado no tiene productos.', 'error');
        return;
      }
      
      const mappedItems: CartItem[] = items.map((i: any) => {
        // Read inventory product to check original stock limit
        const dbProduct = products.find(p => p.id === i.id);
        const originalStock = dbProduct?.stock || 0;
        return {
          id: i.id,
          name: i.name,
          price: i.price,
          stock: originalStock,
          type: dbProduct?.type || 'product',
          cartQuantity: i.quantity
        };
      });
      setOriginalOrderItems(items.map((i: any) => ({ id: i.id, quantity: i.quantity })));
      setCart(mappedItems);
      setActiveOrderId(order.id);
      
      if (order.user_id) {
        setSelectedCustomer({
          id: order.user_id,
          full_name: order.customer_name || 'Cliente Registrado',
          id_document: '',
          phone: order.customer_phone || ''
        });
      } else {
        setSelectedCustomer(null);
      }
      setTab('pos');
      showToast(`Pedido ${order.order_number} cargado al POS para facturación.`, 'success');
    } catch (e) {
      console.error(e);
      showToast('Error al parsear productos del pedido.', 'error');
    }
  };
  const printReceipt = () => {
    window.print();
  };
  const shareOnWhatsApp = () => {
    if (!lastOrder) return;
    let phone = lastOrder.customer?.phone || '';
    if (!phone) {
      const enteredPhone = prompt('Por favor, ingresa el número de WhatsApp del cliente (ej: 584123456789):');
      if (!enteredPhone) return;
      phone = enteredPhone.trim();
    }
    
    let text = `*REXERMI MARKETPLACE* \n`;
    text += `*Ticket:* ${lastOrder.orderNumber}\n`;
    text += `*Fecha:* ${lastOrder.date}\n`;
    text += `*Cliente:* ${lastOrder.customer?.full_name || 'Venta en Mostrador'}\n`;
    text += `*Pago:* ${lastOrder.paymentMethod}\n`;
    if (lastOrder.paymentMethod === 'Mixto' && lastOrder.mixedPayments) {
      Object.entries(lastOrder.mixedPayments).forEach(([method, amount]) => {
        const ref = lastOrder.mixedReferences?.[method];
        text += `  - ${method}: ${formatPrice(amount as number)}${ref ? ` (Ref: ${ref})` : ''}\n`;
      });
    }
    text += `--------------------------------\n`;
    lastOrder.items.forEach((item: any) => {
      text += `• ${item.cartQuantity}x ${item.name} = ${formatPrice(item.price * item.cartQuantity)}\n`;
    });
    text += `--------------------------------\n`;
    if (lastOrder.discount > 0) {
      text += `*Descuento:* -${formatPrice(lastOrder.discount)}\n`;
    }
    text += `*TOTAL:* ${formatPrice(lastOrder.total)}\n`;
    if (dollarRate > 0) {
      text += `*TOTAL Bs.:* ${(lastOrder.total * dollarRate).toFixed(2)} Bs.\n`;
    }
    text += `\n¡Gracias por su preferencia!`;
    const url = `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };
  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando inventario...</div>;
  return (
    <div className="pos-page-container">
      {/* PWA Install Banner */}
      {showInstallBanner && (
        <div style={{
          background: 'linear-gradient(135deg, var(--bg2) 0%, var(--bg3) 100%)',
          borderBottom: '2px solid var(--gold)',
          padding: '0.8rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          zIndex: 1001,
          position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.2rem' }}>📱</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text)' }}>Instalar App Rexermi POS</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Accede más rápido y opera en pantalla completa.</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setShowInstallBanner(false)}
              style={{ padding: '0.4rem 0.8rem', background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}
            >
              Cerrar
            </button>
            <button
              onClick={handlePwaInstall}
              style={{ padding: '0.4rem 1rem', background: 'var(--gold)', border: 'none', color: '#000', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}
            >
              Instalar
            </button>
          </div>
        </div>
      )}
      {/* Shift Header Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: isMobile ? '0.5rem 0.8rem' : '0.8rem 1.5rem',
        background: 'var(--bg3)',
        borderBottom: '1px solid var(--border)',
        flexWrap: 'wrap',
        gap: '0.5rem',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--gold)' }}>⚡ REXERMI POS</span>
          {currentCashier && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text)', background: 'var(--bg2)', padding: '2px 8px', borderRadius: '12px', border: '1px solid var(--border)', fontWeight: 600 }}>
              👤 Cajero: {currentCashier.fullName}
            </span>
          )}
          <span style={{
            fontSize: '0.78rem',
            color: isOnline ? '#2ecc71' : '#e74c3c',
            background: isOnline ? 'rgba(46,204,113,0.1)' : 'rgba(231,76,60,0.1)',
            padding: '2px 8px',
            borderRadius: '12px',
            fontWeight: 600
          }}>
            {isOnline ? '🟢 En Línea' : '🔴 Sin Conexión'}
          </span>
          {offlineQueueLength > 0 && (
            <button
              onClick={() => syncOfflineOrders()}
              disabled={isSyncing || !isOnline}
              style={{
                fontSize: '0.78rem',
                color: isOnline ? '#f1c40f' : 'var(--text-muted)',
                background: 'rgba(241,196,15,0.1)',
                border: '1px solid rgba(241,196,15,0.3)',
                padding: '2px 8px',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: (isSyncing || !isOnline) ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Sincronizar ventas locales al servidor"
            >
              🔄 {isSyncing ? 'Sincronizando...' : `Sincronizar (${offlineQueueLength})`}
            </button>
          )}
          {activeClosure ? (
            <span style={{ fontSize: '0.8rem', color: '#2ecc71', background: 'rgba(46,204,113,0.1)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
              📥 Turno Activo
            </span>
          ) : (
            <span style={{ fontSize: '0.8rem', color: '#e74c3c', background: 'rgba(231,76,60,0.1)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
              📤 Turno Cerrado
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.4rem' : '0.8rem' }}>
          {/* Conversor de Divisa */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg2)',
              borderRadius: '20px',
              border: '1px solid var(--border)',
              padding: '2px',
              cursor: 'pointer',
              userSelect: 'none'
            }}
            onClick={() => setCurrency(currency === 'USD' ? 'VES' : 'USD')}
            title="Cambiar divisa de visualización"
          >
            <div style={{
              padding: '2px 8px',
              borderRadius: '16px',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              background: currency === 'USD' ? 'var(--gold)' : 'transparent',
              color: currency === 'USD' ? '#000' : 'var(--text-muted)',
              transition: 'all 0.2s ease'
            }}>
              USD $
            </div>
            <div style={{
              padding: '2px 8px',
              borderRadius: '16px',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              background: currency === 'VES' ? 'var(--gold)' : 'transparent',
              color: currency === 'VES' ? '#000' : 'var(--text-muted)',
              transition: 'all 0.2s ease'
            }}>
              Bs.
            </div>
          </div>
          <button
            onClick={() => { triggerHaptic('light'); setIsShortcutsHelpOpen(true); setHelpActiveTab('shortcuts'); }}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              padding: isMobile ? '6px 8px' : '6px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
              transition: 'all 0.2s ease'
            }}
            title="Ayuda y Atajos de teclado (Presiona F1 o ?)"
          >
            ❓ Ayuda
          </button>
          {/* Turno Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { triggerHaptic('light'); setIsTurnoDropdownOpen(prev => !prev); }}
              style={{
                background: 'rgba(212, 175, 55, 0.12)',
                border: '1.5px solid var(--gold)',
                color: 'var(--gold)',
                padding: isMobile ? '6px 8px' : '6px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s ease',
              }}
            >
              ⚙️ Gestión de Turno ▾
            </button>
            {isTurnoDropdownOpen && (
              <>
                <div 
                  onClick={() => setIsTurnoDropdownOpen(false)}
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
                />
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.5rem',
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                  padding: '0.8rem',
                  zIndex: 100,
                  minWidth: '220px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                  backdropFilter: 'blur(10px)'
                }}>
                  {activeClosure ? (
                    <>
                      <div style={{ fontSize: '0.8rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem', color: 'var(--text-muted)' }}>
                        💵 Esperado Efectivo:<br/>
                        <strong style={{ color: 'var(--gold)', fontSize: '0.9rem' }}>${activeClosure.expected_amount?.toFixed(2) || '0.00'}</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setIsTurnoDropdownOpen(false); triggerHaptic('light'); setIsQuickSwitchOpen(true); }}
                        style={{ width: '100%', padding: '0.45rem 0.6rem', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                      >
                        👤 Cambiar Cajero
                      </button>
                      <button
                        type="button"
                        onClick={() => { setIsTurnoDropdownOpen(false); handleLockPOS(); }}
                        style={{ width: '100%', padding: '0.45rem 0.6rem', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                      >
                        🔒 Bloquear Pantalla
                      </button>
                      <button
                        type="button"
                        onClick={() => { setIsTurnoDropdownOpen(false); setShowCloseShiftModal(true); }}
                        style={{ width: '100%', padding: '0.45rem 0.6rem', background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', color: '#e74c3c', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 'bold', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        🔒 Cerrar Caja
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setIsTurnoDropdownOpen(false); setShowClosureModal(true); }}
                      style={{ width: '100%', padding: '0.6rem', background: 'linear-gradient(135deg, var(--gold) 0%, #B8961B 100%)', border: 'none', color: '#000', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    >
                      🔓 Abrir Caja
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {/* POS Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
        <button 
          onClick={() => setTab('pos')} 
          style={{ flex: 1, padding: '1rem', background: 'none', border: 'none', color: tab === 'pos' ? 'var(--gold)' : 'var(--text)', borderBottom: tab === 'pos' ? '2px solid var(--gold)' : '2px solid transparent', cursor: 'pointer', fontWeight: 'bold' }}>
          🛒 Nueva Venta (POS)
        </button>
        <button 
          onClick={() => { setTab('orders'); fetchOrders(); }} 
          style={{ flex: 1, padding: '1rem', background: 'none', border: 'none', color: tab === 'orders' ? 'var(--gold)' : 'var(--text)', borderBottom: tab === 'orders' ? '2px solid var(--gold)' : '2px solid transparent', cursor: 'pointer', fontWeight: 'bold' }}>
          📦 Pedidos Tienda ({pendingOrders.length})
        </button>
      </div>
      {tab === 'orders' && (
        <div className="pos-orders-tab" style={{ padding: '1.5rem' }}>
          <h2>Pedidos Pendientes Online</h2>
          {pendingOrders.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No hay pedidos pendientes.</p>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {pendingOrders.map(o => {
                let items = [];
                try {
                  items = o.items_json ? JSON.parse(o.items_json) : [];
                } catch (e) {
                  console.error('Failed to parse items_json for POS order:', o.id, e);
                }
                const isExpanded = expandedOrderId === o.id;
                return (
                  <div 
                    key={o.id} 
                    style={{ 
                      background: 'var(--bg2)', 
                      border: '1px solid var(--border)', 
                      padding: '1rem', 
                      borderRadius: '10px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '0.8rem',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <h3 style={{ margin: '0 0 0.3rem', color: 'var(--gold)' }}>{o.order_number}</h3>
                        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Cliente: {o.customer_name || 'Anónimo'}</p>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>{new Date(o.created_at).toLocaleString()}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '1.15rem', color: 'var(--gold)' }}>{formatPrice(o.total)}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{o.payment_method}</div>
                      </div>
                    </div>
                    {isExpanded && (
                      <div style={{ padding: '0.8rem', background: 'var(--bg3)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <div><strong>👤 Correo:</strong> {o.customer_email || '—'}</div>
                        <div><strong>📞 Teléfono:</strong> {o.customer_phone || '—'}</div>
                        <div><strong>📦 Método de Envío:</strong> {o.shipping_method || '—'}</div>
                        {!o.shipping_method?.toLowerCase().includes('retiro') && (
                          <>
                            <div><strong>📍 Ciudad de entrega:</strong> {o.shipping_city || '—'}</div>
                            <div><strong>🗺️ Dirección detallada:</strong> {o.shipping_address || '—'}</div>
                          </>
                        )}
                        {o.customer_message && <div><strong>📝 Nota del cliente:</strong> "{o.customer_message}"</div>}
                        {o.payment_ref && <div><strong>🔢 Referencia de Pago:</strong> {o.payment_ref}</div>}
                        {o.payment_proof && (
                          <div>
                            <strong>📷 Comprobante: </strong>
                            <a href={`/api/receipts/${o.payment_proof}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', textDecoration: 'underline' }}>
                              Ver imagen adjunta
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                    {items.length > 0 && (
                      <div style={{ paddingTop: '0.5rem', borderTop: '1px dashed var(--border)' }}>
                        <p style={{ margin: '0 0 0.3rem', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Productos del pedido:</p>
                        <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem' }}>
                          {items.map((item: any) => (
                            <li key={item.id}>
                              <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{item.quantity}x</span> {item.name} ({formatPriceLocal(item.price)})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.3rem', borderTop: '1px solid var(--border)', paddingTop: '0.8rem' }}>
                      <button 
                        onClick={() => handleLoadOrderIntoPOS(o)} 
                        style={{ padding: '0.45rem 1rem', background: 'var(--gold)', border: 'none', color: '#000', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', transition: 'all 0.2s' }}
                      >
                        📥 Cargar en POS
                      </button>
                      <button 
                        onClick={() => handleDirectCompleteOrder(o.id)} 
                        style={{ padding: '0.45rem 1rem', background: 'rgba(46,204,113,0.1)', border: '1px solid #2ecc71', color: '#2ecc71', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s' }}
                      >
                        ✓ Completar Directo
                      </button>
                      <button 
                        onClick={() => handleCancelOrder(o.id)} 
                        style={{ padding: '0.45rem 1rem', background: 'rgba(231,76,60,0.1)', border: '1px solid #e74c3c', color: '#e74c3c', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s' }}
                      >
                        🗑️ Cancelar
                      </button>
                      <button 
                        onClick={() => setExpandedOrderId(isExpanded ? null : o.id)} 
                        style={{ padding: '0.45rem 1rem', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', marginLeft: 'auto', transition: 'all 0.2s' }}
                      >
                        {isExpanded ? '▲ Ocultar Detalles' : '▼ Ver Detalles'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {tab === 'pos' && (
        <div className="pos-main" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* LEFT: Cart / Ticket list */}
          <div
            className="pos-products-col"
            style={{
              display: (isMobile && mobileStep !== 'cart') ? 'none' : 'flex',
              flex: 1.5,
              flexDirection: 'column',
              height: '100%',
              overflow: 'hidden'
            }}
          >
            {renderCartListSection()}
          </div>
          {/* RIGHT: Process Steps Column */}
          <div
            className="pos-cart-col"
            style={{
              display: (isMobile && mobileStep === 'cart') ? 'none' : 'flex',
              width: isMobile ? '100%' : '420px',
              flexDirection: 'column',
              height: '100%',
              background: 'var(--bg3)',
              borderLeft: isMobile ? 'none' : '1px solid var(--border)',
              overflowY: 'hidden'
            }}
          >
            {renderCheckoutWizardSection()}
          </div>
        </div>
      )}
      {/* Mobile Bottom Navigation */}
      {isMobile && tab === 'pos' && (
        <div className="bottom-nav" style={{ position: 'relative', zIndex: 1000, background: 'var(--bg2)', borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => { triggerHaptic('light'); setMobileStep('cart'); }}
            className={`bottom-nav-item ${mobileStep === 'cart' ? 'active' : ''}`}
            style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <span className="bottom-nav-icon">🛒</span>
            <span className="bottom-nav-label">Carrito</span>
            {cart.length > 0 && (
              <span className="bottom-nav-badge">
                {cart.reduce((sum, item) => sum + item.cartQuantity, 0)}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => { triggerHaptic('light'); setMobileStep('customer'); setCheckoutStep('customer'); }}
            className={`bottom-nav-item ${mobileStep === 'customer' ? 'active' : ''}`}
            style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <span className="bottom-nav-icon">👤</span>
            <span className="bottom-nav-label">Cliente / Descuento</span>
          </button>
          <button
            type="button"
            onClick={() => { triggerHaptic('light'); setMobileStep('payment'); setCheckoutStep('payment'); }}
            className={`bottom-nav-item ${mobileStep === 'payment' ? 'active' : ''}`}
            style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <span className="bottom-nav-icon">💵</span>
            <span className="bottom-nav-label">Método de Pago</span>
          </button>
        </div>
      )}
      {/* Hidden Print Receipt Template (Optimized for thermal paper) */}
      {((printType === 'order' && lastOrder) || (printType === 'closure' && lastClosureForPrint)) && (
        <div id="thermal-print-area">
          {printType === 'order' && lastOrder && (
            <>
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '15px', marginBottom: '4px' }}>REXERMI MARKETPLACE</div>
              <div style={{ textAlign: 'center', fontSize: '11px', marginBottom: '8px' }}>Venta Facturada POS</div>
              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>
              
              <div style={{ fontSize: '11px', lineHeight: '1.4', marginBottom: '8px' }}>
                <div><strong>Ticket:</strong> {lastOrder.orderNumber}</div>
                <div><strong>Fecha:</strong> {lastOrder.date}</div>
                <div><strong>Cliente:</strong> {lastOrder.customer?.full_name || 'Venta en Mostrador'}</div>
                {lastOrder.customer?.id_document && <div><strong>Doc:</strong> {lastOrder.customer.id_document}</div>}
                <div><strong>Pago:</strong> {lastOrder.paymentMethod}</div>
                {lastOrder.paymentMethod === 'Mixto' && lastOrder.mixedPayments && (
                  <div style={{ paddingLeft: '8px', fontSize: '10.5px', marginTop: '2px' }}>
                    {Object.entries(lastOrder.mixedPayments).map(([method, amount]) => {
                      const ref = lastOrder.mixedReferences?.[method];
                      return (
                        <div key={method}>
                          • {method}: {formatPrice(amount as number)}
                          {ref ? ` (Ref: ${ref})` : ''}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '11px', marginBottom: '4px' }}>
                <span>DETALLE PRODUCTOS</span>
                <span>TOTAL</span>
              </div>
              
              {lastOrder.items.map((item: any) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                  <span style={{ width: '70%', wordBreak: 'break-all' }}>{item.cartQuantity}x {item.name}</span>
                  <span>{formatPrice(item.price * item.cartQuantity)}</span>
                </div>
              ))}
              
              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>
              
              {lastOrder.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', margin: '2px 0' }}>
                  <span>DESCUENTO:</span>
                  <span>-{formatPrice(lastOrder.discount)}</span>
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px', margin: '6px 0 2px 0' }}>
                <span>TOTAL USD:</span>
                <span>{formatPrice(lastOrder.total)}</span>
              </div>
              {dollarRate > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '11px', margin: '2px 0 6px 0', color: '#333' }}>
                  <span>TOTAL VES (Bs.):</span>
                  <span>{(lastOrder.total * dollarRate).toFixed(2)} Bs.</span>
                </div>
              )}
              
              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>
              <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '12px' }}>
                ¡Gracias por su compra y preferencia!
              </div>
            </>
          )}
          {printType === 'closure' && lastClosureForPrint && (
            <>
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>REXERMI MARKETPLACE</div>
              <div style={{ textAlign: 'center', fontSize: '10px', marginBottom: '8px' }}>REPORTE DE CIERRE DE CAJA</div>
              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>
              
              <div style={{ fontSize: '11px', lineHeight: '1.4', marginBottom: '8px' }}>
                <div><strong>Cierre ID:</strong> #{lastClosureForPrint.id}</div>
                <div><strong>Apertura:</strong> {new Date(lastClosureForPrint.opened_at).toLocaleString('es-VE')}</div>
                <div><strong>Cierre:</strong> {new Date(lastClosureForPrint.closed_at || new Date()).toLocaleString('es-VE')}</div>
                <div><strong>Estado:</strong> CERRADO 🔒</div>
              </div>
              
              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>
              
              <div style={{ fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Monto Inicial:</span>
                  <span>{formatPrice(lastClosureForPrint.opening_amount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Ventas Efectivo:</span>
                  <span>{formatPrice(lastClosureForPrint.cash_sales || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px dashed #000', paddingTop: '4px', marginBottom: '4px' }}>
                  <span>Esperado en Caja:</span>
                  <span>{formatPrice(lastClosureForPrint.expected_amount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '4px' }}>
                  <span>Real Contado:</span>
                  <span>{formatPrice(lastClosureForPrint.actual_amount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px dashed #000', paddingTop: '4px', fontSize: '12px' }}>
                  <span>Diferencia:</span>
                  <span>{lastClosureForPrint.discrepancy >= 0 ? '+' : ''}{formatPrice(lastClosureForPrint.discrepancy)}</span>
                </div>
              </div>
              
              {lastClosureForPrint.paymentsBreakdown && lastClosureForPrint.paymentsBreakdown.length > 0 && (
                <>
                  <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>
                  <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 'bold', marginBottom: '4px' }}>DESGLOSE DE PAGOS</div>
                  {lastClosureForPrint.paymentsBreakdown.map((b: any) => (
                    <div key={b.payment_method} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                      <span>{b.payment_method} ({b.count || 0})</span>
                      <span>{formatPrice(b.total)}</span>
                    </div>
                  ))}
                </>
              )}
              {lastClosureForPrint.notes && (
                <>
                  <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>
                  <div style={{ fontSize: '11px' }}><strong>Notas:</strong> {lastClosureForPrint.notes}</div>
                </>
              )}
              
              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>
              <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '12px' }}>
                Turno cerrado con éxito.
              </div>
            </>
          )}
        </div>
      )}
      {/* Apertura de Caja Modal */}
      {showClosureModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: 'var(--bg2)', border: '2px solid var(--gold)', borderRadius: '12px', padding: '2rem', width: '100%', maxWidth: '450px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            <h2 style={{ color: 'var(--gold)', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.4rem' }}>
              🔓 Apertura de Turno de Caja
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 1.5rem 0', lineHeight: '1.4' }}>
              Para poder procesar ventas en el Punto de Venta (POS), debes iniciar un turno de caja indicando el monto en efectivo con el que inicias.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.4rem' }}>
                  Monto Inicial de Apertura ($ USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={openingAmount}
                  onChange={(e) => setOpeningAmount(e.target.value)}
                  className="pos-input"
                  style={{ width: '100%', fontSize: '1rem' }}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.4rem' }}>
                  Notas / Observaciones
                </label>
                <textarea
                  value={closureNotes}
                  onChange={(e) => setClosureNotes(e.target.value)}
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontSize: '0.9rem', outline: 'none', height: '80px', resize: 'none' }}
                  placeholder="Ej. Billetes de baja denominación para vuelto..."
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setShowClosureModal(false)}
                style={{ flex: 1, padding: '0.8rem', background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleOpenClosure}
                style={{ flex: 2, padding: '0.8rem', background: 'linear-gradient(135deg, var(--gold) 0%, #B8961B 100%)', border: 'none', color: '#000', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
              >
                Iniciar Turno
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Cierre de Caja Modal */}
      {showCloseShiftModal && activeClosure && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: 'var(--bg2)', border: '2px solid #e74c3c', borderRadius: '12px', padding: '2rem', width: '100%', maxWidth: '480px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            <h2 style={{ color: '#e74c3c', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.4rem' }}>
              🔒 Cierre de Turno y Caja
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 1.5rem 0', lineHeight: '1.4' }}>
              Por favor cuenta el dinero en efectivo disponible físicamente en la gaveta y regístralo a continuación para calcular si hay descuadres.
            </p>
            
            <div style={{ background: 'var(--bg3)', borderRadius: '8px', padding: '1rem', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Apertura del Turno:</span>
                <strong>{new Date(activeClosure.opened_at).toLocaleString()}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Monto Inicial:</span>
                <strong>${activeClosure.opening_amount.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Ventas POS (Efectivo):</span>
                <strong style={{ color: '#2ecc71' }}>+${(activeClosure.cash_sales || 0).toFixed(2)}</strong>
              </div>
              <div style={{ borderBottom: '1px dashed var(--border)', margin: '0.5rem 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem' }}>
                <span>Total Esperado en Caja:</span>
                <strong style={{ color: 'var(--gold)' }}>${activeClosure.expected_amount?.toFixed(2) || '0.00'}</strong>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.4rem' }}>
                  Monto Real Contado en Físico ($ USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={actualCashAmount}
                  onChange={(e) => setActualCashAmount(e.target.value)}
                  className="pos-input"
                  style={{ width: '100%', fontSize: '1.1rem', fontWeight: 'bold' }}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.4rem' }}>
                  Notas de Cierre
                </label>
                <textarea
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontSize: '0.9rem', outline: 'none', height: '60px', resize: 'none' }}
                  placeholder="Ej. Todo cuadrado..."
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setShowCloseShiftModal(false)}
                style={{ flex: 1, padding: '0.8rem', background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
              >
                Volver
              </button>
              <button
                onClick={handleCloseClosure}
                style={{ flex: 2, padding: '0.8rem', background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
              >
                Cerrar Caja (Terminar Shift)
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Zero Stock Suggestions Modal */}
      {stockAlertProduct && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg2)',
            border: '2px solid var(--error)',
            borderRadius: '16px',
            padding: '2rem',
            width: '100%',
            maxWidth: '450px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            position: 'relative'
          }}>
            <h3 style={{ color: 'var(--error)', margin: '0 0 1rem 0', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ⚠️ Stock Agotado
            </h3>
            <p style={{ color: 'var(--text)', fontSize: '0.88rem', margin: '0 0 1.5rem 0', lineHeight: '1.4' }}>
              El producto <strong>{stockAlertProduct.name}</strong> no tiene existencias disponibles en inventario.
            </p>
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.82rem', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.8rem', fontWeight: 700 }}>
                Sugerencias del mismo rubro:
              </h4>
              {suggestedProducts.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic' }}>
                  No hay otros productos con stock en esta categoría.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {suggestedProducts.map(p => (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'var(--bg3)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        padding: '0.6rem 0.8rem',
                        fontSize: '0.85rem'
                      }}
                    >
                      <div style={{ flex: 1, marginRight: '0.5rem', overflow: 'hidden' }}>
                        <div style={{ fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: 'var(--text)' }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                          Stock: <span style={{ color: p.stock <= 3 ? 'var(--error)' : '#2ecc71', fontWeight: 'bold' }}>{p.stock}</span> | Precio: {formatPriceLocal(p.price)}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          addToCart(p, 1);
                          setStockAlertProduct(null);
                        }}
                        style={{
                          padding: '0.35rem 0.8rem',
                          background: 'var(--gold)',
                          color: '#000',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: '0.75rem',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        Agregar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setStockAlertProduct(null)}
                style={{
                  padding: '0.5rem 1.5rem',
                  background: 'var(--border)',
                  color: 'var(--text)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}
              >
                Entendido (Cerrar)
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Receipt Preview Modal */}
      {lastOrder && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem',
        }}>
          <div style={{
            background: '#fff',
            color: '#000',
            width: '100%',
            maxWidth: '380px',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Header */}
            <div style={{ borderBottom: '2px solid #000', paddingBottom: '0.8rem', marginBottom: '1rem', textAlign: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>📄 Vista Previa de Recibo</h3>
              <span style={{ fontSize: '0.75rem', color: '#666' }}>Rexermi Marketplace POS</span>
            </div>
            {/* Receipt Mock Contents (Scrollable) */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              lineHeight: '1.4',
              padding: '0.5rem',
              background: '#f9f9f9',
              border: '1px solid #ddd',
              borderRadius: '6px',
              color: '#000'
            }}>
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}>REXERMI MARKETPLACE</div>
              <div style={{ textAlign: 'center', fontSize: '10px', marginBottom: '8px' }}>Venta Facturada POS</div>
              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>
              
              <div><strong>Ticket:</strong> {lastOrder.orderNumber}</div>
              <div><strong>Fecha:</strong> {lastOrder.date}</div>
              <div><strong>Cliente:</strong> {lastOrder.customer?.full_name || 'Venta en Mostrador'}</div>
              {lastOrder.customer?.id_document && <div><strong>Doc:</strong> {lastOrder.customer.id_document}</div>}
              <div><strong>Pago:</strong> {lastOrder.paymentMethod}</div>
              
              {lastOrder.paymentMethod === 'Mixto' && lastOrder.mixedPayments && (
                <div style={{ paddingLeft: '8px', fontSize: '10px' }}>
                  {Object.entries(lastOrder.mixedPayments).map(([method, amount]) => {
                    const ref = lastOrder.mixedReferences?.[method];
                    return (
                      <div key={method}>
                        • {method}: ${Number(amount).toFixed(2)}
                        {ref ? ` (Ref: ${ref})` : ''}
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '10px', marginBottom: '4px' }}>
                <span>DETALLE PRODUCTOS</span>
                <span>TOTAL</span>
              </div>
              
              {lastOrder.items.map((item: any) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '3px' }}>
                  <span style={{ width: '70%', wordBreak: 'break-all' }}>{item.cartQuantity}x {item.name}</span>
                  <span>${(item.price * item.cartQuantity).toFixed(2)}</span>
                </div>
              ))}
              
              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>
              
              {lastOrder.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '2px 0' }}>
                  <span>DESCUENTO:</span>
                  <span>-${Number(lastOrder.discount).toFixed(2)}</span>
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12px', margin: '6px 0 2px 0' }}>
                <span>TOTAL USD:</span>
                <span>${Number(lastOrder.total).toFixed(2)}</span>
              </div>
              {dollarRate > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '10px', margin: '2px 0 6px 0', color: '#333' }}>
                  <span>TOTAL VES (Bs.):</span>
                  <span>{(lastOrder.total * dollarRate).toFixed(2)} Bs.</span>
                </div>
              )}
              
              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>
              <div style={{ textAlign: 'center', fontSize: '9px', marginTop: '10px' }}>
                ¡Gracias por su compra y preferencia!
              </div>
            </div>
            {/* Footer Buttons */}
            <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1.2rem' }}>
              <button
                onClick={() => {
                  window.print();
                }}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: 'var(--gold)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem'
                }}
              >
                🖨️ Imprimir Ticket
              </button>
              <button
                onClick={() => {
                  setLastOrder(null);
                }}
                style={{
                  padding: '0.75rem 1.2rem',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.85rem'
                }}
              >
                Listo (Cerrar)
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Suspended Carts Modal */}
      {isSuspendedModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem' }}>
          <div style={{ background: 'var(--bg2)', border: '2px solid var(--gold)', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: '500px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            <h2 style={{ color: 'var(--gold)', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.3rem' }}>
              📂 Ventas en Espera (Suspendidas)
            </h2>
            
            {suspendedCarts.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '2rem 0', textAlign: 'center' }}>
                No hay ventas en espera guardadas.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '300px', overflowY: 'auto', marginBottom: '1.5rem', paddingRight: '4px' }}>
                {suspendedCarts.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg3)', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ flex: 1, marginRight: '0.8rem' }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 'bold' }}>{item.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {item.cart.length} productos | Cliente: {item.selectedCustomer?.full_name || 'Venta en Mostrador'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        onClick={() => handleRestoreSuspendedCart(item)}
                        style={{
                          background: 'var(--gold)',
                          color: '#000',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '0.4rem 0.8rem',
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        Recuperar
                      </button>
                      <button
                        onClick={() => handleRemoveSuspendedCart(item.id)}
                        style={{
                          background: 'rgba(231,76,60,0.12)',
                          color: '#e74c3c',
                          border: '1px solid rgba(231,76,60,0.3)',
                          borderRadius: '6px',
                          padding: '0.4rem 0.6rem',
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setIsSuspendedModalOpen(false)}
                style={{ padding: '0.5rem 1.2rem', background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Generic Product Modal */}
      {isGenericModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem' }}>
          <form onSubmit={handleAddGenericProduct} style={{ background: 'var(--bg2)', border: '2px solid var(--gold)', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            <h2 style={{ color: 'var(--gold)', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.3rem' }}>
              ➕ Agregar Artículo Genérico
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 1.2rem 0', lineHeight: '1.4' }}>
              Añade un concepto rápido al carrito de venta. Omitirá validación de existencias.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.3rem' }}>Nombre / Concepto *</label>
                <input
                  type="text"
                  required
                  value={genericName}
                  onChange={e => setGenericName(e.target.value)}
                  className="pos-input"
                  style={{ width: '100%' }}
                  placeholder="Ej: Artículo sin código, Envase extra, etc."
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.3rem' }}>Precio unitario ($ USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={genericPrice}
                    onChange={e => setGenericPrice(e.target.value)}
                    className="pos-input"
                    style={{ width: '100%' }}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.3rem' }}>Cantidad *</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={genericQty}
                    onChange={e => setGenericQty(e.target.value)}
                    className="pos-input"
                    style={{ width: '100%' }}
                    placeholder="1"
                  />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setIsGenericModalOpen(false)}
                style={{ flex: 1, padding: '0.6rem', background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={{ flex: 2, padding: '0.6rem', background: 'linear-gradient(135deg, var(--gold) 0%, #B8961B 100%)', border: 'none', color: '#000', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Agregar al Carrito
              </button>
            </div>
          </form>
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
      {/* Product Catalog Modal Popup (Glassmorphic, Responsive) */}
      {isCatalogModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: isMobile ? '0' : '1.5rem'
        }}>
          <div style={{
            background: 'var(--bg2)',
            border: isMobile ? 'none' : '1px solid var(--border)',
            borderRadius: isMobile ? '0' : '16px',
            width: isMobile ? '100%' : '95%',
            maxWidth: '1200px',
            height: isMobile ? '100%' : '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: isMobile ? '0.8rem 1rem' : '1rem 1.5rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--bg3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <span style={{ fontSize: '1.4rem' }}>🔍</span>
                <h3 style={{ margin: 0, color: 'var(--gold)', fontSize: '1.25rem', fontWeight: 'bold' }}>
                  Catálogo de Productos y Servicios
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCatalogModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                  padding: '0.2rem 0.5rem',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#ff4d4f'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                ×
              </button>
            </div>
            {/* Search Input Bar inside Modal */}
            <div style={{
              padding: isMobile ? '0.6rem 1rem' : '0.8rem 1.5rem',
              background: 'var(--bg2)',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              gap: '1rem',
              alignItems: 'center'
            }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  ref={catalogSearchRef}
                  type="text"
                  placeholder="Escribe para buscar... [Esc para cerrar]"
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                  className="pos-input"
                  style={{ width: '100%', paddingLeft: '2.5rem' }}
                  onKeyDown={e => {
                    if (e.key === 'Escape') {
                      setIsCatalogModalOpen(false);
                    }
                  }}
                />
                <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>🔍</span>
              </div>
              {catalogSearch && (
                <button
                  type="button"
                  onClick={() => setCatalogSearch('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    textDecoration: 'underline'
                  }}
                >
                  Limpiar búsqueda
                </button>
              )}
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Resultados: <strong style={{ color: 'var(--gold)' }}>{catalogFilteredProducts.length}</strong>
              </div>
            </div>
            {/* Modal Body */}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', flex: 1, overflow: 'hidden' }}>
              {/* Left Sidebar: Categories */}
              <div style={{
                width: isMobile ? '100%' : '220px',
                borderRight: isMobile ? 'none' : '1px solid var(--border)',
                borderBottom: isMobile ? '1px solid var(--border)' : 'none',
                background: 'var(--bg3)',
                display: 'flex',
                flexDirection: isMobile ? 'row' : 'column',
                overflowY: isMobile ? 'hidden' : 'auto',
                overflowX: isMobile ? 'auto' : 'hidden',
                padding: isMobile ? '0.6rem 1rem' : '1rem',
                gap: '0.5rem',
                flexShrink: 0
              }}>
                {!isMobile && (
                  <h4 style={{ margin: '0 0 0.8rem 0', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    📂 Categorías
                  </h4>
                )}
                <button
                  onClick={() => setSelectedCategory(null)}
                  style={{
                    display: isMobile ? 'inline-block' : 'block',
                    width: isMobile ? 'auto' : '100%',
                    whiteSpace: 'nowrap',
                    padding: '0.5rem 0.8rem',
                    textAlign: 'left',
                    background: selectedCategory === null ? 'rgba(212,175,55,0.15)' : 'none',
                    border: selectedCategory === null ? '1px solid var(--gold)' : '1px solid transparent',
                    color: selectedCategory === null ? 'var(--gold)' : 'var(--text)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: selectedCategory === null ? 'bold' : 'normal',
                    marginBottom: isMobile ? '0' : '0.4rem',
                    transition: 'all 0.2s',
                    flexShrink: 0
                  }}
                >
                  📁 Todas ({products.length})
                </button>
                {(() => {
                  const catCounts: { [key: string]: number } = {};
                  products.forEach(p => {
                    if (p.cat_name) {
                      catCounts[p.cat_name] = (catCounts[p.cat_name] || 0) + 1;
                    }
                  });
                  const uniqueCategories = Object.keys(catCounts).sort();
                  return uniqueCategories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      style={{
                        display: isMobile ? 'inline-block' : 'block',
                        width: isMobile ? 'auto' : '100%',
                        whiteSpace: 'nowrap',
                        padding: '0.5rem 0.8rem',
                        textAlign: 'left',
                        background: selectedCategory === cat ? 'rgba(212,175,55,0.15)' : 'none',
                        border: selectedCategory === cat ? '1px solid var(--gold)' : '1px solid transparent',
                        color: selectedCategory === cat ? 'var(--gold)' : 'var(--text)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        fontWeight: selectedCategory === cat ? 'bold' : 'normal',
                        marginBottom: isMobile ? '0' : '0.4rem',
                        transition: 'all 0.2s',
                        flexShrink: 0
                      }}
                    >
                      📁 {cat} ({catCounts[cat]})
                    </button>
                  ));
                })()}
              </div>
              {/* Right Grid */}
              <div
                onScroll={handleCatalogScroll}
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: isMobile ? '0.75rem' : '1.5rem',
                  background: 'var(--bg2)'
                }}
              >
                {catalogFilteredProducts.length === 0 ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: 'var(--text-muted)'
                  }}>
                    <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛍️</span>
                    <p style={{ margin: 0, fontSize: '1.1rem' }}>No se encontraron productos en esta sección.</p>
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(130px, 1fr))' : 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: isMobile ? '0.6rem' : '1rem',
                    alignContent: 'start'
                  }}>
                    {catalogFilteredProducts.slice(0, catalogVisibleCount).map(p => {
                      const isOutOfStock = p.type === 'product' && p.stock < 1;
                      const isLowStock = p.type === 'product' && p.stock > 0 && p.stock <= 3;
                      const isContact = p.price_type === 'contact' || p.price === 0;
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            if (isContact) {
                              showToast(`Producto de consulta: ${p.name}. Utilice el canal de WhatsApp.`, 'info');
                              const text = `Hola, me interesa acordar el precio de ${p.name}`;
                              const url = `https://wa.me/584141234567?text=${encodeURIComponent(text)}`;
                              window.open(url, '_blank');
                            } else if (!isOutOfStock) {
                              addToCart(p);
                            }
                          }}
                          style={{
                            background: 'var(--bg3)',
                            border: isOutOfStock
                              ? '1px solid var(--border)'
                              : isLowStock
                                ? '1px solid rgba(241, 196, 15, 0.4)'
                                : '1px solid var(--border)',
                            borderRadius: '12px',
                            padding: '0.8rem',
                            cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                            opacity: isOutOfStock ? 0.4 : 1,
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                            boxShadow: isLowStock ? '0 0 8px rgba(241,196,15,0.08)' : 'none',
                            position: 'relative'
                          }}
                          className="pos-product-card"
                        >
                          <div style={{
                            position: 'relative',
                            width: '100%',
                            aspectRatio: '4/3',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            background: 'var(--bg2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.8rem'
                          }}>
                            {p.image ? (
                              <img
                                src={p.image.startsWith('http') || p.image.startsWith('/api/assets/uploads/') ? p.image : `/api/assets/uploads/${p.image}`}
                                alt={p.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              p.type === 'service' ? '⚙️' : '🛍️'
                            )}
                            {isLowStock && (
                              <span style={{
                                position: 'absolute', top: '4px', right: '4px',
                                background: '#f1c40f', color: '#000', fontSize: '0.6rem',
                                fontWeight: 'bold', padding: '1px 5px', borderRadius: '4px'
                              }}>
                                Bajo Stock
                              </span>
                            )}
                            {isOutOfStock && (
                              <span style={{
                                position: 'absolute', top: '4px', right: '4px',
                                background: '#e74c3c', color: '#fff', fontSize: '0.6rem',
                                fontWeight: 'bold', padding: '1px 5px', borderRadius: '4px'
                              }}>
                                Agotado
                              </span>
                            )}
                          </div>
                          <div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>ID: {p.id}</div>
                            <h4 style={{ margin: '0.2rem 0', fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.name}>
                              {p.name}
                            </h4>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', gap: '0.3rem' }}>
                            <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                              {formatProductPrice(p.price, p.price_type, p.price_max)}
                            </span>
                            {p.type === 'product' && !isContact && (
                              <span style={{ fontSize: '0.7rem', color: isOutOfStock ? 'var(--error)' : 'var(--text-muted)', fontWeight: 500 }}>
                                Stock: {p.stock}
                              </span>
                            )}
                            {isContact && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--success)', fontWeight: 600 }}>
                                💬 Consultar
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            {/* Footer */}
            <div style={{
              padding: '0.8rem 1.5rem',
              borderTop: '1px solid var(--border)',
              background: 'var(--bg3)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.82rem',
              color: 'var(--text-muted)'
            }}>
              <span>💡 Haz clic en cualquier tarjeta para agregarla al carrito. [Esc] para cerrar.</span>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setIsCatalogModalOpen(false)}
                style={{ padding: '0.4rem 1.2rem', fontSize: '0.8rem' }}
              >
                Cerrar Catálogo
              </button>
            </div>
          </div>
        </div>
      )}
      {/* PIN LOCK SCREEN OVERLAY */}
      {isLocked && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(10,10,15,0.98)',
          backdropFilter: 'blur(12px)',
          zIndex: 11000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text)'
        }}>
          <div style={{ background: 'var(--bg2)', border: '1.5px solid var(--gold)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '340px', boxShadow: '0 8px 32px rgba(212,175,55,0.15)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ fontSize: '3rem', color: 'var(--gold)' }}>🔒</div>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ margin: 0, color: 'var(--text)' }}>Terminal Bloqueado</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Introduce tu PIN de 4 dígitos para desbloquear</p>
            </div>
            
            {/* Dots */}
            <div style={{ display: 'flex', gap: '1rem', margin: '0.5rem 0' }}>
              {[0, 1, 2, 3].map(i => (
                <div 
                  key={i} 
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    border: '1.5px solid var(--gold)',
                    background: pinInput.length > i ? 'var(--gold)' : 'transparent',
                    transition: 'all 0.15s ease'
                  }} 
                />
              ))}
            </div>
            {/* Keys Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', width: '100%' }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Clear', '0', '⌫'].map(key => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handlePinKeyPress(key)}
                  style={{
                    padding: '0.8rem',
                    background: 'var(--bg3)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    borderRadius: '50%',
                    width: '60px',
                    height: '60px',
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto',
                    transition: 'all 0.1s'
                  }}
                  className="numpad-key"
                >
                  {key === 'Clear' ? 'C' : key}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* PIN SETTING OVERLAY */}
      {isSettingPin && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(10,10,15,0.98)',
          backdropFilter: 'blur(12px)',
          zIndex: 11000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text)'
        }}>
          <div style={{ background: 'var(--bg2)', border: '1.5px solid var(--gold)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '340px', boxShadow: '0 8px 32px rgba(212,175,55,0.15)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ fontSize: '3rem', color: 'var(--gold)' }}>🔑</div>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ margin: 0, color: 'var(--text)' }}>Configura tu PIN</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Crea un PIN de 4 dígitos para proteger esta caja</p>
            </div>
            
            {/* Dots */}
            <div style={{ display: 'flex', gap: '1rem', margin: '0.5rem 0' }}>
              {[0, 1, 2, 3].map(i => (
                <div 
                  key={i} 
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    border: '1.5px solid var(--gold)',
                    background: pinInput.length > i ? 'var(--gold)' : 'transparent',
                    transition: 'all 0.15s ease'
                  }} 
                />
              ))}
            </div>
            {/* Keys Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', width: '100%' }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Clear', '0', '⌫'].map(key => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSettingPinKeyPress(key)}
                  style={{
                    padding: '0.8rem',
                    background: 'var(--bg3)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    borderRadius: '50%',
                    width: '60px',
                    height: '60px',
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto',
                    transition: 'all 0.1s'
                  }}
                  className="numpad-key"
                >
                  {key === 'Clear' ? 'C' : key}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setIsSettingPin(false)}
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '0.5rem 1.2rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {/* Abono Modal */}
      {isAbonoModalOpen && selectedCustomer && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem' }}>
          <form onSubmit={handleRegisterAbono} style={{ background: 'var(--bg2)', border: '2px solid var(--gold)', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            <h2 style={{ color: 'var(--gold)', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.3rem' }}>
              💵 Registrar Abono de Deuda
            </h2>
            <div style={{ background: 'var(--bg3)', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '1.2rem', fontSize: '0.82rem' }}>
              <div><strong>Cliente:</strong> {selectedCustomer.full_name}</div>
              <div style={{ marginTop: '4px' }}><strong>Deuda Pendiente:</strong> <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>${(selectedCustomer.credit_used || 0).toFixed(2)} USD</span></div>
              <div><strong>Límite de Crédito:</strong> ${(selectedCustomer.credit_limit || 0).toFixed(2)} USD</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.3rem' }}>Monto a abonar ($ USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedCustomer.credit_used || 0}
                  required
                  value={abonoAmount}
                  onChange={e => setAbonoAmount(e.target.value)}
                  className="pos-input"
                  style={{ width: '100%' }}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.3rem' }}>Método de Pago *</label>
                <select 
                  value={abonoPaymentMethod} 
                  onChange={e => setAbonoPaymentMethod(e.target.value)} 
                  className="pos-input" 
                  style={{ width: '100%', background: 'var(--bg3)', color: 'var(--text)' }}
                >
                  <option value="Efectivo">💵 Efectivo</option>
                  <option value="Pago Móvil">📱 Pago Móvil</option>
                  <option value="Transferencia">🏦 Transferencia Bancaria</option>
                  <option value="Zelle">🇺🇸 Zelle</option>
                  <option value="Otros">💳 Otros</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.3rem' }}>Referencia / Notas</label>
                <input
                  type="text"
                  value={abonoReference}
                  onChange={e => setAbonoReference(e.target.value)}
                  className="pos-input"
                  style={{ width: '100%' }}
                  placeholder="Ej: Pago móvil ref #1234, etc."
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => { setIsAbonoModalOpen(false); setAbonoAmount(''); setAbonoReference(''); }}
                style={{ flex: 1, padding: '0.6rem', background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={processingAbono}
                style={{ flex: 2, padding: '0.6rem', background: 'linear-gradient(135deg, var(--gold) 0%, #B8961B 100%)', border: 'none', color: '#000', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', opacity: processingAbono ? 0.6 : 1 }}
              >
                {processingAbono ? 'Procesando...' : 'Confirmar e Imprimir'}
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Quick Switch Modal */}
      {isQuickSwitchOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem' }}>
          <div style={{ background: 'var(--bg2)', border: '2px solid var(--gold)', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: '380px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            
            {/* Modal Navigation */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '1.2rem' }}>
              <button 
                type="button"
                onClick={() => setIsConfiguringPin(false)}
                style={{ flex: 1, padding: '0.6rem', background: 'none', border: 'none', color: !isConfiguringPin ? 'var(--gold)' : 'var(--text)', borderBottom: !isConfiguringPin ? '2px solid var(--gold)' : '2px solid transparent', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
              >
                🔑 Cambiar Cajero
              </button>
              <button 
                type="button"
                onClick={() => setIsConfiguringPin(true)}
                style={{ flex: 1, padding: '0.6rem', background: 'none', border: 'none', color: isConfiguringPin ? 'var(--gold)' : 'var(--text)', borderBottom: isConfiguringPin ? '2px solid var(--gold)' : '2px solid transparent', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
              >
                ⚙️ Configurar mi PIN
              </button>
            </div>
            {!isConfiguringPin ? (
              <form onSubmit={handleQuickSwitch}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 1rem 0', lineHeight: '1.4', textAlign: 'center' }}>
                  Ingresa tu PIN de 4 dígitos para ingresar al terminal POS bajo tu sesión.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={quickSwitchPin}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '');
                      setQuickSwitchPin(val);
                    }}
                    placeholder="••••"
                    style={{ 
                      fontSize: '2rem', 
                      letterSpacing: '0.8rem', 
                      textAlign: 'center', 
                      width: '180px', 
                      padding: '0.5rem',
                      background: 'var(--bg3)',
                      border: '1.5px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text)'
                    }}
                    autoFocus
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => { setIsQuickSwitchOpen(false); setQuickSwitchPin(''); }}
                    style={{ flex: 1, padding: '0.6rem', background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    style={{ flex: 1, padding: '0.6rem', background: 'linear-gradient(135deg, var(--gold) 0%, #B8961B 100%)', border: 'none', color: '#000', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    Ingresar
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleConfigurePin}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 1rem 0', lineHeight: '1.4' }}>
                  Asigna una clave PIN rápida de 4 dígitos para tu usuario actual. Necesitarás tu contraseña para autorizar.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.3rem' }}>Contraseña de cuenta *</label>
                    <input
                      type="password"
                      required
                      value={pinSettingPassword}
                      onChange={e => setPinSettingPassword(e.target.value)}
                      className="pos-input"
                      style={{ width: '100%' }}
                      placeholder="Ingresa tu contraseña actual"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.3rem' }}>Nuevo PIN de 4 dígitos *</label>
                    <input
                      type="password"
                      maxLength={4}
                      required
                      value={pinSettingNewPin}
                      onChange={e => setPinSettingNewPin(e.target.value.replace(/\D/g, ''))}
                      className="pos-input"
                      style={{ width: '100%', textAlign: 'center', letterSpacing: '0.4rem', fontSize: '1.1rem' }}
                      placeholder="1234"
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => { setIsQuickSwitchOpen(false); setPinSettingPassword(''); setPinSettingNewPin(''); }}
                    style={{ flex: 1, padding: '0.6rem', background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    style={{ flex: 1, padding: '0.6rem', background: 'linear-gradient(135deg, var(--gold) 0%, #B8961B 100%)', border: 'none', color: '#000', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    Guardar PIN
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {/* Keyboard Shortcuts Help Modal */}
      {isShortcutsHelpOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, padding: '1rem' }}>
          <div style={{ background: 'var(--bg2)', border: '2px solid var(--gold)', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: '460px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            <h2 style={{ color: 'var(--gold)', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.3rem' }}>
              ❓ Centro de Ayuda - POS
            </h2>
            
            {/* Modal Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '1.2rem', gap: '0.5rem' }}>
              <button 
                type="button"
                onClick={() => setHelpActiveTab('shortcuts')}
                style={{ flex: 1, padding: '0.6rem', background: 'none', border: 'none', color: helpActiveTab === 'shortcuts' ? 'var(--gold)' : 'var(--text)', borderBottom: helpActiveTab === 'shortcuts' ? '2px solid var(--gold)' : '2px solid transparent', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
              >
                ⌨️ Atajos
              </button>
              <button 
                type="button"
                onClick={() => setHelpActiveTab('features')}
                style={{ flex: 1, padding: '0.6rem', background: 'none', border: 'none', color: helpActiveTab === 'features' ? 'var(--gold)' : 'var(--text)', borderBottom: helpActiveTab === 'features' ? '2px solid var(--gold)' : '2px solid transparent', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
              >
                📖 Funciones
              </button>
            </div>
            {helpActiveTab === 'features' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '320px', overflowY: 'auto', marginBottom: '1.5rem', paddingRight: '0.3rem', fontSize: '0.82rem', textAlign: 'left', lineHeight: '1.4' }}>
                <div>
                  <h4 style={{ color: 'var(--gold)', margin: '0 0 0.2rem 0', display: 'flex', alignItems: 'center', gap: '4px' }}>👤 Cambio de Cajero</h4>
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                    Permite cambiar de cajero al instante. Haz clic en el botón <strong>"👤 Cambiar Cajero"</strong> del encabezado e ingresa tu PIN de 4 dígitos.
                  </p>
                </div>
                <div>
                  <h4 style={{ color: 'var(--gold)', margin: '0 0 0.2rem 0', display: 'flex', alignItems: 'center', gap: '4px' }}>💵 Abonos a Crédito</h4>
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                    Cuando seleccionas un cliente con deuda pendiente en el POS, aparecerá el botón <strong>"💵 Abonar"</strong>. Podrás ingresar abonos con cualquier método de pago y se registrarán en su historial de crédito.
                  </p>
                </div>
                <div>
                  <h4 style={{ color: 'var(--gold)', margin: '0 0 0.2rem 0', display: 'flex', alignItems: 'center', gap: '4px' }}>📈 Alerta de Margen Crítico</h4>
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                    El POS calcula el costo real de los productos agregados en tiempo real. Si aplicas un descuento que reduce el margen neto de ganancia por debajo del <strong>10%</strong>, se mostrará una advertencia roja antes de facturar.
                  </p>
                </div>
                <div>
                  <h4 style={{ color: 'var(--gold)', margin: '0 0 0.2rem 0', display: 'flex', alignItems: 'center', gap: '4px' }}>➕ Item Genérico</h4>
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                    Ideal para servicios o artículos sin código de barra. Presiona <strong>"➕ Item Genérico"</strong> en la cabecera, define un concepto y precio, y agrégalo directamente al carrito.
                  </p>
                </div>
                <div>
                  <h4 style={{ color: 'var(--gold)', margin: '0 0 0.2rem 0', display: 'flex', alignItems: 'center', gap: '4px' }}>⏸️ Ventas en Espera (Suspender)</h4>
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                    Si un cliente se demora al pagar, haz clic en <strong>"⏸️ Suspender"</strong> para guardar el carrito y atender al siguiente cliente. Recupéralo después en la pestaña <strong>"📂 En Espera"</strong>.
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '320px', overflowY: 'auto', marginBottom: '1.5rem', paddingRight: '0.3rem' }}>
                {[
                  { keys: ['F1', '?'], desc: 'Mostrar / ocultar esta ayuda' },
                  { keys: ['F2', 'Alt+S'], desc: 'Enfocar buscador de productos' },
                  { keys: ['F3', 'Alt+G'], desc: 'Agregar item genérico o servicio' },
                  { keys: ['F4', 'Alt+W'], desc: 'Suspender carrito actual' },
                  { keys: ['F6', 'Alt+D'], desc: 'Alternar moneda (USD / VES Bolívares)' },
                  { keys: ['F7', 'Alt+E'], desc: 'Ver ventas en espera (suspendidas)' },
                  { keys: ['F8', 'Alt+M'], desc: 'Enfocar selección de método de pago' },
                  { keys: ['F9', 'Alt+C'], desc: 'Enfocar buscador de clientes' },
                  { keys: ['F10', 'Alt+P'], desc: 'Procesar venta / Confirmar compra' },
                  { keys: ['Alt+K'], desc: 'Cambio rápido de cajero (PIN)' },
                  { keys: ['ESC', 'Alt+X'], desc: 'Vaciar el carrito de compras' },
                ].map((shortcut, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)' }}>{shortcut.desc}</span>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      {shortcut.keys.map((k, j) => (
                        <kbd key={j} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px', fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--gold)' }}>
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <button
              onClick={() => setIsShortcutsHelpOpen(false)}
              style={{ width: '100%', padding: '0.6rem', background: 'linear-gradient(135deg, var(--gold) 0%, #B8961B 100%)', border: 'none', color: '#000', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
      {/* CSS @media print style injector to hide page styles when printing */}
      <style jsx global>{`
        #thermal-print-area {
          display: none;
        }
        @media print {
          @page {
            margin: 0 !important;
            size: auto;
          }
          html, body {
            background: #fff !important;
            color: #000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
          nav, aside, button, header, footer, .navbar, .pos-main, .admin-sidebar, .admin-topbar, .modal-overlay, .drawer-backdrop, .modal {
            display: none !important;
          }
          #thermal-print-area {
            display: block !important;
            width: 76mm !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 2mm 4mm !important;
            box-sizing: border-box !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 11px !important;
            line-height: 1.3 !important;
            color: #000 !important;
            background: #fff !important;
          }
        }
      `}</style>
    </div>
  );
}
