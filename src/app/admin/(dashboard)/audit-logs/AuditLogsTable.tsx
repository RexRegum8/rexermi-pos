'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

interface AuditLog {
  id: number;
  admin_id: number | null;
  admin_email: string;
  action: string;
  details: string;
  created_at: string;
}

export default function AuditLogsTable({
  initialLogs,
  totalPages,
  currentPage,
  totalItems
}: {
  initialLogs: AuditLog[];
  totalPages: number;
  currentPage: number;
  totalItems: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

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

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentSearch = searchParams.get('search') || '';
      if (searchQuery.trim() !== currentSearch.trim()) {
        updateURL({ search: searchQuery.trim(), page: '1' });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      updateURL({ page: String(page) });
    }
  };

  const getActionBadgeColor = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('sincronizac')) return 'rgba(212, 175, 55, 0.15)'; // gold
    if (act.includes('precio') || act.includes('lote')) return 'rgba(139, 92, 246, 0.15)'; // purple
    if (act.includes('eliminar') || act.includes('inactiv')) return 'rgba(231, 76, 60, 0.15)'; // red
    if (act.includes('crear') || act.includes('nuevo')) return 'rgba(46, 204, 113, 0.15)'; // green
    return 'rgba(255, 255, 255, 0.08)';
  };

  const getActionBadgeTextColor = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('sincronizac')) return 'var(--gold)';
    if (act.includes('precio') || act.includes('lote')) return '#a78bfa';
    if (act.includes('eliminar') || act.includes('inactiv')) return 'var(--error)';
    if (act.includes('crear') || act.includes('nuevo')) return '#2ecc71';
    return 'var(--text-muted)';
  };

  return (
    <>
      <div className="admin-topbar">
        <h1>🔍 Registro de Auditoría</h1>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          Historial de acciones administrativas críticas en el sistema.
        </div>
      </div>

      {/* Filters & Search */}
      <div className="filters-bar" style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', background: 'var(--bg2)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="text"
            placeholder="🔍 Buscar por administrador, acción o detalles..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.5rem', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }}
          />
          <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}></span>
        </div>
      </div>

      {/* Logs Table */}
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th style={{ width: '160px' }}>Fecha</th>
              <th style={{ width: '220px' }}>Administrador</th>
              <th style={{ width: '220px' }}>Acción</th>
              <th>Detalles de la Acción</th>
            </tr>
          </thead>
          <tbody>
            {initialLogs.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 0' }}>
                  No se encontraron registros de auditoría.
                </td>
              </tr>
            ) : (
              initialLogs.map(log => (
                <tr
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  style={{ cursor: 'pointer', transition: 'background 0.2s ease' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {new Date(log.created_at).toLocaleString('es-VE', { hour12: false })}
                  </td>
                  <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    {log.admin_email}
                  </td>
                  <td>
                    <span style={{
                      padding: '0.2rem 0.6rem',
                      borderRadius: '12px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: getActionBadgeColor(log.action),
                      color: getActionBadgeTextColor(log.action),
                      border: `1px solid ${getActionBadgeTextColor(log.action)}15`,
                      whiteSpace: 'nowrap'
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.details}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', background: 'var(--bg2)', padding: '0.8rem 1.2rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Mostrando página <strong>{currentPage}</strong> de {totalPages} ({totalItems} registros totales)
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              style={{ padding: '0.4rem 0.8rem', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1, fontSize: '0.8rem' }}
            >
              ◀ Anterior
            </button>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              style={{ padding: '0.4rem 0.8rem', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1, fontSize: '0.8rem' }}
            >
              Siguiente ▶
            </button>
          </div>
        </div>
      )}

      {/* Log Details Modal */}
      {selectedLog && (
        <div
          onClick={() => setSelectedLog(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg2)', border: '2px solid var(--gold)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '600px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', position: 'relative' }}
          >
            <button
              onClick={() => setSelectedLog(null)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}
            >
              ×
            </button>
            <h3 style={{ color: 'var(--gold)', margin: '0 0 1.2rem 0', fontSize: '1.3rem' }}>
              📄 Detalle del Registro de Auditoría
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingBottom: '0.6rem' }}>
                <span style={{ width: '120px', color: 'var(--text-muted)', fontWeight: 600 }}>Fecha:</span>
                <span style={{ fontFamily: 'monospace' }}>{new Date(selectedLog.created_at).toLocaleString('es-VE')}</span>
              </div>
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingBottom: '0.6rem' }}>
                <span style={{ width: '120px', color: 'var(--text-muted)', fontWeight: 600 }}>Administrador:</span>
                <span>{selectedLog.admin_email} (ID: {selectedLog.admin_id || '—'})</span>
              </div>
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingBottom: '0.6rem' }}>
                <span style={{ width: '120px', color: 'var(--text-muted)', fontWeight: 600 }}>Acción:</span>
                <span style={{
                  padding: '0.1rem 0.5rem',
                  borderRadius: '8px',
                  background: getActionBadgeColor(selectedLog.action),
                  color: getActionBadgeTextColor(selectedLog.action),
                  fontWeight: 'bold',
                  fontSize: '0.75rem'
                }}>{selectedLog.action}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Detalles Completos:</span>
                <div style={{
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '1rem',
                  color: 'var(--text)',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  lineHeight: '1.4'
                }}>
                  {selectedLog.details}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.8rem' }}>
              <button
                onClick={() => setSelectedLog(null)}
                style={{ padding: '0.6rem 2rem', background: 'var(--gold)', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
