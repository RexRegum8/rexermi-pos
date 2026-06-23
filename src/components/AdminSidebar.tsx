'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useToast } from '@/context/ToastContext';

const NAV_GROUPS = [
  {
    id: 'inicio',
    title: 'Inicio',
    icon: '🏠',
    items: [
      { href: '/admin', label: 'Dashboard', icon: '📊', exact: true },
      { href: '/pos', label: 'Punto de Venta', icon: '🛒' },
      { href: '/admin/support', label: 'Soporte', icon: '💬' },
    ]
  },
  {
    id: 'operaciones',
    title: 'Operaciones',
    icon: '💼',
    items: [
      { href: '/admin/orders', label: 'Pedidos', icon: '📦' },
      { href: '/admin/purchases', label: 'Compras', icon: '📥' },
      { href: '/admin/reports', label: 'Reportes y Cajas', icon: '📝' },
      { href: '/admin/history', label: 'Historial', icon: '📈' },
      { href: '/admin/reviews', label: 'Calificaciones', icon: '⭐' },
    ]
  },
  {
    id: 'inventario',
    title: 'Inventario',
    icon: '📦',
    items: [
      { href: '/admin/products', label: 'Productos', icon: '🛍️' },
      { href: '/admin/products/audit', label: 'Auditoría de Stock', icon: '🔍' },
      { href: '/admin/coupons', label: 'Cupones', icon: '🎫' },
    ]
  },
  {
    id: 'contactos',
    title: 'Contactos',
    icon: '👥',
    items: [
      { href: '/admin/credit', label: 'Crédito y Puntos', icon: '💳' },
      { href: '/admin/suppliers', label: 'Proveedores', icon: '🤝' },
    ]
  },
  {
    id: 'sistema',
    title: 'Sistema',
    icon: '⚙️',
    items: [
      { href: '/admin/users', label: 'Usuarios', icon: '👥' },
      { href: '/admin/backup', label: 'Respaldo', icon: '💾' },
      { href: '/admin/settings', label: 'Ajustes', icon: '⚙️' },
      { href: '/admin/audit-logs', label: 'Auditoría', icon: '🔍' },
    ]
  }
];

export default function AdminSidebar({ adminName, permissions = {} }: { adminName: string; permissions?: Record<string, boolean> }) {
  const pathname = usePathname();
  const router = useRouter();
  const { showToast } = useToast();
  const [unreadCount, setUnreadCount] = useState(0);
  const [outOfStockCount, setOutOfStockCount] = useState(0);
  const lastUnreadCount = useRef<number | null>(null);
  const lastPendingOrdersCount = useRef<number | null>(null);
  const lastOutOfStockCount = useRef<number | null>(null);

  // Dynamic menu filtering
  const filteredNavGroups = React.useMemo(() => {
    return NAV_GROUPS.map(group => {
      const items = group.items.filter(item => {
        if (item.href === '/admin' || item.href === '/admin/support') return true;
        if (item.href === '/pos') return !!permissions.pos_access;
        if (['/admin/orders', '/admin/purchases', '/admin/reports', '/admin/history', '/admin/reviews'].includes(item.href)) {
          return !!permissions.view_reports;
        }
        if (['/admin/products', '/admin/products/audit', '/admin/coupons', '/admin/suppliers'].includes(item.href)) {
          return !!permissions.edit_products;
        }
        if (item.href === '/admin/credit') return !!permissions.manage_credits;
        if (['/admin/users', '/admin/backup', '/admin/settings', '/admin/audit-logs'].includes(item.href)) {
          return !!permissions.manage_users;
        }
        return true;
      });
      return { ...group, items };
    }).filter(group => group.items.length > 0);
  }, [permissions]);

  // Expanded groups state (default all true on mount)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    inicio: true,
    operaciones: true,
    inventario: true,
    contactos: true,
    sistema: true
  });

  // Mobile drawer state
  const [isOpen, setIsOpen] = useState(false);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  useEffect(() => {
    // Use Server-Sent Events for real-time notifications instead of polling
    let es: EventSource | null = null;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const connectSSE = () => {
      try {
        es = new EventSource('/api/admin/sse');

        es.addEventListener('unread', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            const count = data.count ?? 0;
            setUnreadCount(count);

            if (lastUnreadCount.current !== null && count > lastUnreadCount.current) {
              if (Notification.permission === 'granted') {
                new Notification('💬 Nuevo mensaje de soporte', {
                  body: `Tienes ${count} mensaje(s) sin leer en el chat.`,
                  icon: '/favicon.ico'
                });
              }
            }
            lastUnreadCount.current = count;
          } catch { /* ignore parse errors */ }
        });

        es.addEventListener('pending_orders', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            const count = data.count ?? 0;

            if (lastPendingOrdersCount.current !== null && count > lastPendingOrdersCount.current) {
              if (Notification.permission === 'granted') {
                new Notification('📦 Nuevo pedido registrado', {
                  body: `Hay ${count} pedido(s) pendiente(s) de revisión.`,
                  icon: '/favicon.ico'
                });
              }
            }
            lastPendingOrdersCount.current = count;
          } catch { /* ignore parse errors */ }
        });

        es.addEventListener('out_of_stock', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            const count = data.count ?? 0;
            setOutOfStockCount(count);

            if (lastOutOfStockCount.current !== null && count > lastOutOfStockCount.current) {
              if (Notification.permission === 'granted') {
                new Notification('⚠️ Producto Agotado', {
                  body: `¡Atención! Tienes ${count} producto(s) sin inventario.`,
                  icon: '/favicon.ico'
                });
              }
              showToast(`⚠️ ¡Atención! Un producto se ha quedado sin stock.`, 'info');
            }
            lastOutOfStockCount.current = count;
          } catch { /* ignore parse errors */ }
        });

        es.onerror = () => {
          // SSE failed — fall back to polling every 30s
          es?.close();
          es = null;
          if (!fallbackInterval) {
            const poll = async () => {
              try {
                const res = await fetch('/api/admin/chat/unread');
                const data = (await res.json()) as any;
                if (data.success) {
                  const count = data.count;
                  setUnreadCount(count);
                  if (lastUnreadCount.current !== null && count > lastUnreadCount.current) {
                    if (Notification.permission === 'granted') {
                      new Notification('💬 Nuevo mensaje de soporte', {
                        body: `Tienes ${count} mensaje(s) sin leer.`,
                        icon: '/favicon.ico'
                      });
                    }
                  }
                  lastUnreadCount.current = count;
                }
              } catch { /* silent */ }
            };
            poll();
            fallbackInterval = setInterval(poll, 30000);
          }
        };
      } catch {
        // EventSource not supported — use polling
        const poll = async () => {
          try {
            const res = await fetch('/api/admin/chat/unread');
            const data = (await res.json()) as any;
            if (data.success) {
              const count = data.count;
              setUnreadCount(count);
              if (lastUnreadCount.current !== null && count > lastUnreadCount.current) {
                if (Notification.permission === 'granted') {
                  new Notification('💬 Nuevo mensaje de soporte', {
                    body: `Tienes ${count} mensaje(s) sin leer.`,
                    icon: '/favicon.ico'
                  });
                }
              }
              lastUnreadCount.current = count;
            }
          } catch { /* silent */ }
        };
        poll();
        fallbackInterval = setInterval(poll, 30000);
      }
    };

    connectSSE();

    return () => {
      es?.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, []);

  useEffect(() => {
    const triggerBackupCheck = async () => {
      try {
        const res = await fetch('/api/admin/backup/auto-check');
        if (res.ok) {
          const data = (await res.json()) as any;
          if (data.triggered) {
            showToast(`✅ Respaldo automático realizado: ${data.filename}`, 'success');
            window.dispatchEvent(new CustomEvent('backup-triggered', { detail: { lastBackup: data.lastBackup } }));
          }
        }
      } catch (err) {
        console.error('Error running automatic backup check:', err);
      }
    };

    const delayTimeout = setTimeout(triggerBackupCheck, 3000);
    const interval = setInterval(triggerBackupCheck, 20 * 60 * 1000);

    return () => {
      clearTimeout(delayTimeout);
      clearInterval(interval);
    };
  }, [showToast]);

  // Auto-expand group of active link
  useEffect(() => {
    const activeGroup = filteredNavGroups.find(group => 
      group.items.some(item => 
        item.exact ? pathname === item.href : pathname.startsWith(item.href)
      )
    );
    if (activeGroup) {
      setExpandedGroups(prev => ({
        ...prev,
        [activeGroup.id]: true
      }));
    }
  }, [pathname, filteredNavGroups]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/admin-logout', { method: 'POST' });
      showToast('Sesión de administrador cerrada.', 'info');
      window.location.href = '/admin/login';
    } catch (e) {
      console.error('Logout error', e);
    }
  };

  const renderNavContent = () => (
    <>
      <div className="admin-logo" style={{ userSelect: 'none' }}>⚡ REXERMI</div>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.5rem', textAlign: 'center', userSelect: 'none' }}>
        Admin: <strong>{adminName}</strong>
      </p>
      <nav style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <ul className="admin-menu">
          {filteredNavGroups.map(group => {
            const isExpanded = !!expandedGroups[group.id];
            return (
              <li key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="admin-menu-group-header"
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>{group.icon}</span>
                    <span>{group.title}</span>
                  </span>
                  <span style={{ 
                    fontSize: '0.55rem', 
                    transition: 'transform 0.2s ease', 
                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    display: 'inline-block'
                  }}>
                    ▶
                  </span>
                </button>
                {isExpanded && (
                  <ul className="admin-menu" style={{ paddingLeft: '0.6rem', gap: '0.15rem' }}>
                    {group.items.map(item => {
                      const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                      return (
                        <li key={item.href}>
                          <Link 
                            href={item.href} 
                            className={isActive ? 'active' : ''}
                            onClick={() => setIsOpen(false)}
                          >
                            <span style={{ display: 'flex', alignItems: 'center' }}>
                              <span className="nav-icon">{item.icon}</span>
                              <span>{item.label}</span>
                            </span>
                             {item.label === 'Soporte' && unreadCount > 0 && (
                              <span style={{
                                backgroundColor: '#E74C3C',
                                color: '#fff',
                                fontSize: '0.72rem',
                                fontWeight: 'bold',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                display: 'inline-block',
                                lineHeight: 1
                              }}>
                                {unreadCount}
                              </span>
                            )}
                            {item.label === 'Productos' && outOfStockCount > 0 && (
                              <span style={{
                                backgroundColor: '#E74C3C',
                                color: '#fff',
                                fontSize: '0.72rem',
                                fontWeight: 'bold',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                display: 'inline-block',
                                lineHeight: 1
                              }} title="Productos sin inventario">
                                {outOfStockCount}
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <div style={{ marginTop: 'auto', paddingTop: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        <button
          onClick={handleLogout}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.8rem 1.2rem', background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.2)', borderRadius: 'var(--radius)', color: 'var(--error)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
        >
          🚪 Cerrar Sesión
        </button>
        <div style={{ textAlign: 'center' }}>
          <Link href="/" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
            ← Ver tienda
          </Link>
        </div>
      </div>
    </>
  );

  return (
    <div className="admin-sidebar-wrapper" style={{ width: '100%' }}>
      {/* Header */}
      <header className="admin-mobile-header" style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '1rem', padding: '0.8rem 1.2rem', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', height: '60px', width: '100%' }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '1.6rem',
            color: 'var(--text)',
            cursor: 'pointer',
            padding: '0.4rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ☰
        </button>
        <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--gold)', letterSpacing: '1px', userSelect: 'none' }}>
          ⚡ REXERMI
        </span>
      </header>

      {/* Drawer Overlay & Sidebar */}
      {isOpen && (
        <>
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(4px)',
              zIndex: 9998,
            }}
          />
          <aside
            className="animate-slide-in"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: '280px',
              maxWidth: '85vw',
              background: 'var(--bg2)',
              borderRight: '1px solid var(--border)',
              padding: '1.5rem 1.2rem',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 9999,
              boxShadow: '10px 0 30px rgba(0,0,0,0.6)',
              userSelect: 'none',
            }}
          >
            <button
              onClick={() => setIsOpen(false)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.2rem',
              }}
            >
              ✕
            </button>
            {renderNavContent()}
          </aside>
        </>
      )}
    </div>
  );
}
