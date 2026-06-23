'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminKeyboardShortcuts() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [helpActiveTab, setHelpActiveTab] = useState<'shortcuts' | 'features'>('shortcuts');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const isInput = active && (
        active.tagName === 'INPUT' || 
        active.tagName === 'TEXTAREA' || 
        active.tagName === 'SELECT' || 
        active.hasAttribute('contenteditable')
      );

      // F1 or '?' (if not typing) -> Toggle Shortcuts Help
      if (e.key === 'F1' || (e.key === '?' && !isInput)) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }

      // Alt + 1 or Alt + D -> Dashboard
      if ((e.altKey && e.key === '1') || (e.altKey && e.key.toLowerCase() === 'd')) {
        e.preventDefault();
        router.push('/admin');
      }

      // Alt + 2 or Alt + O -> Orders/Pedidos
      if ((e.altKey && e.key === '2') || (e.altKey && e.key.toLowerCase() === 'o')) {
        e.preventDefault();
        router.push('/admin/orders');
      }

      // Alt + 3 or Alt + P -> Products/Productos
      if ((e.altKey && e.key === '3') || (e.altKey && e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        router.push('/admin/products');
      }

      // Alt + 4 or Alt + C -> Credit
      if ((e.altKey && e.key === '4') || (e.altKey && e.key.toLowerCase() === 'c')) {
        e.preventDefault();
        router.push('/admin/credit');
      }

      // Alt + 5 or Alt + R -> Reports/Cajas
      if ((e.altKey && e.key === '5') || (e.altKey && e.key.toLowerCase() === 'r')) {
        e.preventDefault();
        router.push('/admin/reports');
      }

      // Alt + 6 or Alt + U -> Users/Usuarios
      if ((e.altKey && e.key === '6') || (e.altKey && e.key.toLowerCase() === 'u')) {
        e.preventDefault();
        router.push('/admin/users');
      }

      // Alt + 7 or Alt + A -> Settings/Ajustes
      if ((e.altKey && e.key === '7') || (e.altKey && e.key.toLowerCase() === 'a')) {
        e.preventDefault();
        router.push('/admin/settings');
      }

      // Alt + 8 or Alt + V -> Go to POS
      if ((e.altKey && e.key === '8') || (e.altKey && e.key.toLowerCase() === 'v')) {
        e.preventDefault();
        router.push('/pos');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse-help-admin {
          0% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 0.5); }
          70% { box-shadow: 0 0 0 10px rgba(212, 175, 55, 0); }
          100% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 0); }
        }
      `}} />

      {/* Floating help button in the bottom right corner */}
      <button
        onClick={() => { setIsOpen(true); setHelpActiveTab('shortcuts'); }}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9999,
          width: '46px',
          height: '46px',
          borderRadius: '50%',
          background: 'var(--bg2)',
          border: '1.5px solid var(--gold)',
          color: 'var(--gold)',
          boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.25rem',
          transition: 'all 0.25s ease',
          animation: 'pulse-help-admin 2s infinite'
        }}
        title="Ayuda y Atajos (Presiona F1 o ?)"
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.background = 'rgba(212, 175, 55, 0.1)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.background = 'var(--bg2)';
        }}
      >
        ❓
      </button>

      {/* Help Modal */}
      {isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: '1rem' }}>
          <div style={{ background: 'var(--bg2)', border: '2px solid var(--gold)', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: '450px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            <h2 style={{ color: 'var(--gold)', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.3rem' }}>
              ❓ Ayuda de Administración
            </h2>
            
            {/* Tabs Navigation */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '1.2rem', gap: '0.5rem' }}>
              <button 
                type="button"
                onClick={() => setHelpActiveTab('shortcuts')}
                style={{ flex: 1, padding: '0.6rem', background: 'none', border: 'none', color: helpActiveTab === 'shortcuts' ? 'var(--gold)' : 'var(--text)', borderBottom: helpActiveTab === 'shortcuts' ? '2px solid var(--gold)' : '2px solid transparent', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
              >
                ⌨️ Navegación
              </button>
              <button 
                type="button"
                onClick={() => setHelpActiveTab('features')}
                style={{ flex: 1, padding: '0.6rem', background: 'none', border: 'none', color: helpActiveTab === 'features' ? 'var(--gold)' : 'var(--text)', borderBottom: helpActiveTab === 'features' ? '2px solid var(--gold)' : '2px solid transparent', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
              >
                📊 Módulos
              </button>
            </div>

            {helpActiveTab === 'features' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '320px', overflowY: 'auto', marginBottom: '1.5rem', paddingRight: '0.3rem', fontSize: '0.82rem', textAlign: 'left', lineHeight: '1.4' }}>
                <div>
                  <h4 style={{ color: 'var(--gold)', margin: '0 0 0.2rem 0' }}>📈 Dashboard (Panel Principal)</h4>
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                    Visualización en tiempo real de estadísticas de ventas, productos populares y estado operativo de la tienda.
                  </p>
                </div>
                <div>
                  <h4 style={{ color: 'var(--gold)', margin: '0 0 0.2rem 0' }}>📦 Pedidos</h4>
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                    Administra los pedidos de clientes online. Permite aprobar facturas, coordinar despachos de delivery y anular/cancelar ventas.
                  </p>
                </div>
                <div>
                  <h4 style={{ color: 'var(--gold)', margin: '0 0 0.2rem 0' }}>🛍️ Inventario de Productos</h4>
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                    Creación y edición de catálogo de productos. Permite ajustar inventario físicamente, configurar códigos de barras y revisar el historial de costo de compra.
                  </p>
                </div>
                <div>
                  <h4 style={{ color: 'var(--gold)', margin: '0 0 0.2rem 0' }}>💳 Crédito y Puntos</h4>
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                    Control de límites de crédito asignados a clientes, estado de sus cuentas pendientes, cobros realizados y saldos de puntos de lealtad.
                  </p>
                </div>
                <div>
                  <h4 style={{ color: 'var(--gold)', margin: '0 0 0.2rem 0' }}>📝 Reportes y Cajas</h4>
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                    Historial de turnos de caja y arqueos diarios (`cash_closures`). Permite a la gerencia verificar discrepancias de efectivo y aprobar cierres de turno.
                  </p>
                </div>
                <div>
                  <h4 style={{ color: 'var(--gold)', margin: '0 0 0.2rem 0' }}>💾 Respaldo y Base de Datos</h4>
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                    Herramienta de exportación e importación completa de la base de datos Sqlite local en formato ZIP o Excel para resguardo seguro.
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '320px', overflowY: 'auto', marginBottom: '1.5rem', paddingRight: '0.3rem' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0 0 0.5rem 0', textAlign: 'left' }}>
                  Usa estas combinaciones rápidas de teclado (`Alt + Tecla`) desde cualquier sección de administración:
                </p>
                {[
                  { keys: ['F1', '?'], desc: 'Mostrar / ocultar esta ayuda' },
                  { keys: ['Alt+1', 'Alt+D'], desc: 'Ir a Dashboard / Panel principal' },
                  { keys: ['Alt+2', 'Alt+O'], desc: 'Ir a Pedidos (Orders)' },
                  { keys: ['Alt+3', 'Alt+P'], desc: 'Ir a Productos (Inventory)' },
                  { keys: ['Alt+4', 'Alt+C'], desc: 'Ir a Crédito y Puntos (Customers)' },
                  { keys: ['Alt+5', 'Alt+R'], desc: 'Ir a Reportes y Cajas (Closures)' },
                  { keys: ['Alt+6', 'Alt+U'], desc: 'Ir a Usuarios / Permisos' },
                  { keys: ['Alt+7', 'Alt+A'], desc: 'Ir a Ajustes del Sistema' },
                  { keys: ['Alt+8', 'Alt+V'], desc: 'Ir a Punto de Venta (POS)' },
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
              onClick={() => setIsOpen(false)}
              style={{ width: '100%', padding: '0.6rem', background: 'linear-gradient(135deg, var(--gold) 0%, #B8961B 100%)', border: 'none', color: '#000', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
