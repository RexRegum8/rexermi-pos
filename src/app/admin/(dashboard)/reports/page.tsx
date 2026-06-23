'use client';

import React, { useState, useEffect } from 'react';
import { useToast } from '@/context/ToastContext';

interface VendorSales {
  vendor_id: number;
  vendor_name: string;
  vendor_email: string;
  total_orders: number;
  total_sales: number;
  cash_sales: number;
  commission_amount: number;
}

interface CashClosure {
  id: number;
  user_id: number;
  cashier_name: string;
  opened_at: string;
  closed_at: string | null;
  opening_amount: number;
  expected_amount: number;
  actual_amount: number | null;
  notes: string | null;
  status: 'open' | 'closed';
}

interface SupplierStats {
  supplier_id: number;
  supplier_name: string;
  supplier_phone: string | null;
  total_orders: number;
  total_cost: number;
  avg_lead_time_days: number | null;
}

export default function AdminReportsPage() {
  const [activeTab, setActiveTab] = useState<'commissions' | 'closures' | 'suppliers'>('commissions');
  const [loading, setLoading] = useState(true);
  const [vendorSales, setVendorSales] = useState<VendorSales[]>([]);
  const [closures, setClosures] = useState<CashClosure[]>([]);
  const [supplierStats, setSupplierStats] = useState<SupplierStats[]>([]);
  const [commissionRate, setCommissionRate] = useState(5.0);
  const [searchTerm, setSearchTerm] = useState('');
  const { showToast } = useToast();

  // Commission dynamic editor states
  const [isEditingCommission, setIsEditingCommission] = useState(false);
  const [tempCommissionRate, setTempCommissionRate] = useState('5.0');
  const [savingCommission, setSavingCommission] = useState(false);

  const handleSaveCommission = async () => {
    const parsed = parseFloat(tempCommissionRate);
    if (isNaN(parsed) || parsed < 0 || parsed > 100) {
      showToast('Por favor introduce un porcentaje válido entre 0 y 100.', 'error');
      return;
    }

    setSavingCommission(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            commission_rate: String(parsed.toFixed(1))
          }
        }),
      });
      const data = (await res.json()) as any;
      if (res.ok) {
        showToast('✅ Tasa de comisión actualizada correctamente.', 'success');
        setCommissionRate(parsed);
        setIsEditingCommission(false);
        // Refresh calculations
        fetchReportData();
      } else {
        showToast(data.error || 'Error al guardar la comisión.', 'error');
      }
    } catch (err) {
      console.error('Error saving commission rate:', err);
      showToast('Error de red al guardar la comisión.', 'error');
    } finally {
      setSavingCommission(false);
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/reports/sales-summary');
      const data = (await res.json()) as any;
      if (data.success) {
        setVendorSales(data.vendorSales || []);
        setClosures(data.closures || []);
        setSupplierStats(data.supplierStats || []);
        setCommissionRate(data.commissionRate || 5.0);
        setTempCommissionRate(String(data.commissionRate || 5.0));
      } else {
        showToast(data.error || 'Error al cargar los reportes.', 'error');
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
      showToast('Error de conexión con el servidor.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  const handleExportExcel = () => {
    // Open excel export endpoint in new window/tab to trigger download
    window.open('/api/admin/reports/excel', '_blank');
    showToast('Generando reporte Excel...', 'info');
  };

  // Calculations for summary stats
  const totalSales = vendorSales.reduce((sum, v) => sum + v.total_sales, 0);
  const totalCommissions = vendorSales.reduce((sum, v) => sum + v.commission_amount, 0);
  const activeClosuresCount = closures.filter(c => c.status === 'open').length;

  const filteredVendorSales = vendorSales.filter(v =>
    v.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.vendor_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredClosures = closures.filter(c =>
    c.cashier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.notes || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSupplierStats = supplierStats.filter(s =>
    s.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.supplier_phone || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ padding: '1.5rem', color: 'var(--text)', background: 'var(--bg-main)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--primary)', margin: 0 }}>📊 Reportes y Turnos de Caja</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.2rem 0 0 0' }}>Gestiona las comisiones de vendedores y audita el dinero en efectivo del POS.</p>
        </div>
        <button
          onClick={handleExportExcel}
          style={{
            background: 'linear-gradient(135deg, #27AE60 0%, #219653 100%)',
            color: '#fff',
            border: 'none',
            padding: '0.6rem 1.2rem',
            borderRadius: 'var(--radius)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}
        >
          📥 Exportar a Excel
        </button>
      </div>

      {/* Quick Config Hint */}
      <div style={{
        background: 'rgba(212, 175, 55, 0.03)',
        border: '1px dashed rgba(212, 175, 55, 0.3)',
        borderRadius: 'var(--radius)',
        padding: '0.8rem 1.2rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.8rem',
        fontSize: '0.88rem'
      }}>
        <span style={{ color: 'var(--text-muted)' }}>
          💡 <strong>Configuración del Sistema:</strong> Puedes ajustar la tasa de cambio de dólares, horarios comerciales, métodos de pago y de envío en el panel de configuración general.
        </span>
        <a
          href="/admin/settings"
          style={{
            color: 'var(--gold)',
            fontWeight: 600,
            textDecoration: 'underline',
            fontSize: '0.82rem',
            whiteSpace: 'nowrap'
          }}
        >
          Ir a Ajustes ⚙️
        </a>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '1.2rem', borderRadius: 'var(--radius)', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.8rem', textTransform: 'uppercase' }}>Tasa de Comisión</p>
            {!isEditingCommission && (
              <button
                onClick={() => {
                  setTempCommissionRate(String(commissionRate));
                  setIsEditingCommission(true);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--gold)',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(212, 175, 55, 0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                ✏️ Editar
              </button>
            )}
          </div>
          
          {isEditingCommission ? (
            <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={tempCommissionRate}
                  onChange={e => setTempCommissionRate(e.target.value)}
                  style={{
                    background: 'var(--bg-input, var(--bg3))',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '0.3rem 0.5rem',
                    color: 'var(--text)',
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                    width: '80px',
                    outline: 'none'
                  }}
                  disabled={savingCommission}
                />
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>%</span>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  onClick={handleSaveCommission}
                  disabled={savingCommission}
                  style={{
                    background: 'var(--gold)',
                    color: '#000',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    opacity: savingCommission ? 0.7 : 1
                  }}
                >
                  {savingCommission ? '...' : 'Guardar'}
                </button>
                <button
                  onClick={() => setIsEditingCommission(false)}
                  disabled={savingCommission}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.78rem',
                    color: 'var(--text)',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '0.4rem 0 0 0', color: 'var(--primary, var(--gold))' }}>
              {commissionRate}%
            </p>
          )}
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '1.2rem', borderRadius: 'var(--radius)' }}>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.8rem', textTransform: 'uppercase' }}>Ventas POS Totales</p>
          <p style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '0.4rem 0 0 0' }}>
            ${totalSales.toFixed(2)}
          </p>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '1.2rem', borderRadius: 'var(--radius)' }}>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.8rem', textTransform: 'uppercase' }}>Comisiones Acumuladas</p>
          <p style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '0.4rem 0 0 0', color: '#27AE60' }}>
            ${totalCommissions.toFixed(2)}
          </p>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '1.2rem', borderRadius: 'var(--radius)' }}>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.8rem', textTransform: 'uppercase' }}>Turnos Abiertos POS</p>
          <p style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '0.4rem 0 0 0', color: activeClosuresCount > 0 ? '#E67E22' : 'var(--text)' }}>
            {activeClosuresCount}
          </p>
        </div>
      </div>

      {/* Tabs and Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <button
            onClick={() => setActiveTab('commissions')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'commissions' ? '3px solid var(--primary)' : '3px solid transparent',
              color: activeTab === 'commissions' ? 'var(--primary)' : 'var(--text-muted)',
              padding: '0.8rem 0.5rem',
              fontWeight: 600,
              fontSize: '1rem',
              cursor: 'pointer'
            }}
          >
            👥 Comisiones por Vendedor
          </button>
          <button
            onClick={() => setActiveTab('closures')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'closures' ? '3px solid var(--primary)' : '3px solid transparent',
              color: activeTab === 'closures' ? 'var(--primary)' : 'var(--text-muted)',
              padding: '0.8rem 0.5rem',
              fontWeight: 600,
              fontSize: '1rem',
              cursor: 'pointer'
            }}
          >
            🏪 Cierres de Caja (Turnos)
          </button>
          <button
            onClick={() => setActiveTab('suppliers')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'suppliers' ? '3px solid var(--primary)' : '3px solid transparent',
              color: activeTab === 'suppliers' ? 'var(--primary)' : 'var(--text-muted)',
              padding: '0.8rem 0.5rem',
              fontWeight: 600,
              fontSize: '1rem',
              cursor: 'pointer'
            }}
          >
            🤝 Rendimiento de Proveedores
          </button>
        </div>
        <div style={{ marginBottom: '0.5rem' }}>
          <input
            type="text"
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--bg-input)',
              color: 'var(--text)',
              fontSize: '0.9rem',
              width: '240px'
            }}
          />
        </div>
      </div>

      {/* Data Views */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Cargando datos...
        </div>
      ) : activeTab === 'commissions' ? (
        <div className="table-responsive" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '1rem' }}>Vendedor</th>
                <th style={{ padding: '1rem' }}>Correo</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Ventas POS</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Total Facturado ($)</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Ventas Efectivo ($)</th>
                <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--primary)' }}>Comisión ({commissionRate}%)</th>
              </tr>
            </thead>
            <tbody>
              {filteredVendorSales.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No se encontraron registros de ventas de POS para comisiones.
                  </td>
                </tr>
              ) : (
                filteredVendorSales.map((v) => (
                  <tr key={v.vendor_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>{v.vendor_name}</td>
                    <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{v.vendor_email}</td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>{v.total_orders} pedidos</td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 500 }}>${v.total_sales.toFixed(2)}</td>
                    <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-muted)' }}>${v.cash_sales.toFixed(2)}</td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold', color: '#27AE60' }}>
                      ${v.commission_amount.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : activeTab === 'closures' ? (
        <div className="table-responsive" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '1rem' }}>Cajero</th>
                <th style={{ padding: '1rem' }}>Apertura / Turno</th>
                <th style={{ padding: '1rem' }}>Cierre</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Monto Apertura</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Esperado Caja</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Contado Caja</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Diferencia</th>
                <th style={{ padding: '1rem' }}>Estado</th>
                <th style={{ padding: '1rem' }}>Notas</th>
              </tr>
            </thead>
            <tbody>
              {filteredClosures.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No se encontraron turnos de caja registrados.
                  </td>
                </tr>
              ) : (
                filteredClosures.map((c) => {
                  const discrepancy = c.status === 'closed' ? (c.actual_amount! - c.expected_amount) : 0;
                  const discrepancyColor = discrepancy === 0 ? 'var(--text)' : discrepancy < 0 ? '#E74C3C' : '#27AE60';
                  
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{c.cashier_name}</td>
                      <td style={{ padding: '1rem', fontSize: '0.82rem' }}>
                        {new Date(c.opened_at).toLocaleString()}
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.82rem', color: c.closed_at ? 'var(--text)' : 'var(--text-muted)' }}>
                        {c.closed_at ? new Date(c.closed_at).toLocaleString() : 'En curso'}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>${c.opening_amount.toFixed(2)}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 500 }}>${c.expected_amount.toFixed(2)}</td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        {c.actual_amount !== null ? `$${c.actual_amount.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold', color: discrepancyColor }}>
                        {c.status === 'closed' ? (
                          discrepancy === 0 ? '$0.00' : `${discrepancy > 0 ? '+' : ''}$${discrepancy.toFixed(2)}`
                        ) : '—'}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          background: c.status === 'open' ? 'rgba(230,126,34,0.15)' : 'rgba(39,174,96,0.15)',
                          color: c.status === 'open' ? '#E67E22' : '#27AE60',
                        }}>
                          {c.status === 'open' ? 'Abierta' : 'Cerrada'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--text-muted)' }} title={c.notes || ''}>
                        {c.notes || 'Sin notas'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-responsive" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '1rem' }}>Proveedor</th>
                <th style={{ padding: '1rem' }}>Teléfono</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Órdenes Recibidas</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Total Invertido (USD)</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Tiempo Promedio de Entrega</th>
              </tr>
            </thead>
            <tbody>
              {filteredSupplierStats.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No se encontraron estadísticas de proveedores.
                  </td>
                </tr>
              ) : (
                filteredSupplierStats.map((s) => (
                  <tr key={s.supplier_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>{s.supplier_name}</td>
                    <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{s.supplier_phone || '—'}</td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>{s.total_orders} compras</td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 500 }}>${s.total_cost.toFixed(2)}</td>
                    <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-muted)' }}>
                      {s.avg_lead_time_days !== null && s.avg_lead_time_days !== undefined ? (
                        s.avg_lead_time_days < 0.04 ? 'Menos de 1 hora' :
                        s.avg_lead_time_days < 1 ? `${Math.round(s.avg_lead_time_days * 24)} horas` :
                        `${s.avg_lead_time_days.toFixed(1)} días`
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
