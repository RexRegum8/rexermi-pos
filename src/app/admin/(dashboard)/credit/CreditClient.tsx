'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/context/ToastContext';

interface CreditClientProps {
  initialConfig: Record<string, string>;
}

interface Client {
  user_id: number;
  full_name: string;
  email: string;
  phone: string;
  id_document: string;
  credit_limit: number;
  credit_used: number;
  loyalty_points: number;
  credit_status: 'active' | 'suspended' | 'cancelled';
}

interface CreditRequest {
  id: number;
  order_id: number;
  user_id: number;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  customer_name: string;
  customer_phone: string;
  order_number: string;
  order_total: number;
  credit_limit: number | null;
  credit_used: number | null;
  loyalty_points: number | null;
}

export default function CreditClient({ initialConfig }: CreditClientProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'config' | 'requests' | 'clients'>('config');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Configuration state
  const [config, setConfig] = useState<Record<string, string>>(initialConfig);
  const [savingConfig, setSavingConfig] = useState(false);

  // Data states
  const [clients, setClients] = useState<Client[]>([]);
  const [requests, setRequests] = useState<CreditRequest[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Search/Filter states
  const [clientSearch, setClientSearch] = useState('');
  const [requestSearch, setRequestSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal states
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [modalMode, setModalMode] = useState<'payment' | 'adjust' | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  const [paymentNotes, setPaymentNotes] = useState('');
  
  // Adjust states
  const [adjustLimit, setAdjustLimit] = useState('');
  const [adjustPoints, setAdjustPoints] = useState('');
  const [adjustStatus, setAdjustStatus] = useState<'active' | 'suspended' | 'cancelled'>('active');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Request resolution states
  const [resolvingRequest, setResolvingRequest] = useState<CreditRequest | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<'approved' | 'rejected'>('approved');
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Client Detail view states
  const [detailClient, setDetailClient] = useState<Client | null>(null);
  const [detailCreditHistory, setDetailCreditHistory] = useState<any[]>([]);
  const [detailLoyaltyHistory, setDetailLoyaltyHistory] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const handleViewClientDetails = async (client: Client) => {
    setDetailClient(client);
    setDetailCreditHistory([]);
    setDetailLoyaltyHistory([]);
    setLoadingDetails(true);
    try {
      const url = `/api/admin/credit/clients?userId=${client.user_id}`;
      const res = await fetch(url);
      const data = await res.json() as any;
      if (data.success) {
        setDetailClient(data.client);
        setDetailCreditHistory(data.creditHistory || []);
        setDetailLoyaltyHistory(data.loyaltyHistory || []);
      } else {
        showToast(data.error || 'Error al obtener detalles del cliente.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error al conectar con el servidor.', 'error');
    } finally {
      setLoadingDetails(false);
    }
  };

  // Fetch functions
  const fetchClients = async () => {
    setLoadingClients(true);
    try {
      const res = await fetch('/api/admin/credit/clients');
      const data = await res.json() as any;
      if (data.success) {
        setClients(data.clients);
      } else {
        showToast(data.error || 'Error al obtener clientes.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al obtener clientes.', 'error');
    } finally {
      setLoadingClients(false);
    }
  };

  const fetchRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await fetch('/api/admin/credit/requests');
      const data = await res.json() as any;
      if (data.success) {
        setRequests(data.requests);
      } else {
        showToast(data.error || 'Error al obtener peticiones.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al obtener peticiones.', 'error');
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'clients') {
      fetchClients();
    } else if (activeTab === 'requests') {
      fetchRequests();
    }
  }, [activeTab]);

  if (!mounted) return null;

  // Handle configuration update
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await fetch('/api/admin/credit/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      const data = await res.json() as any;
      if (data.success) {
        showToast('✅ Configuración de crédito guardada exitosamente.', 'success');
        router.refresh();
      } else {
        showToast(data.error || 'Error al guardar configuración.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al guardar configuración.', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleConfigChange = (key: string, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleDayToggle = (day: number) => {
    const currentDays = config.credit_schedule_days ? config.credit_schedule_days.split(',').filter(Boolean).map(Number) : [];
    let nextDays: number[];
    if (currentDays.includes(day)) {
      nextDays = currentDays.filter(d => d !== day);
    } else {
      nextDays = [...currentDays, day].sort();
    }
    handleConfigChange('credit_schedule_days', nextDays.join(','));
  };

  // Handle abonos / payments
  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    setSubmittingAction(true);
    try {
      const res = await fetch('/api/admin/credit/clients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'payment',
          userId: selectedClient.user_id,
          amount: parseFloat(paymentAmount),
          notes: paymentNotes
        }),
      });
      const data = await res.json() as any;
      if (data.success) {
        showToast(`✅ Abono de $${parseFloat(paymentAmount).toFixed(2)} registrado. Límite recalculado.`, 'success');
        setModalMode(null);
        setPaymentAmount('');
        setPaymentNotes('');
        fetchClients();
        if (selectedClient) {
          // fetch latest client details for details modal
          const latestRes = await fetch(`/api/admin/credit/clients?userId=${selectedClient.user_id}`);
          const latestData = await latestRes.json() as any;
          if (latestData.success) {
            setDetailClient(latestData.client);
            setDetailCreditHistory(latestData.creditHistory);
            setDetailLoyaltyHistory(latestData.loyaltyHistory);
          }
        }
        setSelectedClient(null);
      } else {
        showToast(data.error || 'Error al registrar abono.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al registrar abono.', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handle client account adjustment
  const handleAdjustAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    setSubmittingAction(true);
    try {
      const res = await fetch('/api/admin/credit/clients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adjust',
          userId: selectedClient.user_id,
          limit: parseFloat(adjustLimit),
          points: parseInt(adjustPoints),
          status: adjustStatus,
          notes: adjustNotes
        }),
      });
      const data = await res.json() as any;
      if (data.success) {
        showToast('✅ Cuenta de crédito ajustada con éxito.', 'success');
        setModalMode(null);
        setAdjustLimit('');
        setAdjustPoints('');
        setAdjustStatus('active');
        setAdjustNotes('');
        fetchClients();
        if (selectedClient) {
          // fetch latest client details for details modal
          const latestRes = await fetch(`/api/admin/credit/clients?userId=${selectedClient.user_id}`);
          const latestData = await latestRes.json() as any;
          if (latestData.success) {
            setDetailClient(latestData.client);
            setDetailCreditHistory(latestData.creditHistory);
            setDetailLoyaltyHistory(latestData.loyaltyHistory);
          }
        }
        setSelectedClient(null);
      } else {
        showToast(data.error || 'Error al ajustar cuenta.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al ajustar cuenta.', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handle request resolution
  const handleResolveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingRequest) return;
    setSubmittingAction(true);
    try {
      const res = await fetch('/api/admin/credit/requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: resolvingRequest.id,
          status: resolutionStatus,
          adminNotes: resolutionNotes
        }),
      });
      const data = await res.json() as any;
      if (data.success) {
        showToast(`✅ Petición de crédito ${resolutionStatus === 'approved' ? 'aprobada' : 'rechazada'} exitosamente.`, 'success');
        setResolvingRequest(null);
        setResolutionNotes('');
        fetchRequests();
      } else {
        showToast(data.error || 'Error al procesar resolución.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al procesar resolución.', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Filtering lists
  const filteredClients = clients.filter(c => {
    const term = clientSearch.toLowerCase();
    return (
      c.full_name.toLowerCase().includes(term) ||
      (c.email && c.email.toLowerCase().includes(term)) ||
      (c.phone && c.phone.includes(term)) ||
      (c.id_document && c.id_document.includes(term))
    );
  });

  const filteredRequests = requests.filter(r => {
    const term = requestSearch.toLowerCase();
    const matchesSearch = (
      r.customer_name.toLowerCase().includes(term) ||
      r.order_number.toLowerCase().includes(term) ||
      (r.customer_phone && r.customer_phone.includes(term))
    );
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ marginTop: '1rem' }}>
      {/* Tabs Menu */}
      <div className="tab-menu" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => {
            setActiveTab('config');
          }} 
          className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`}
          style={{
            padding: '0.6rem 1.2rem',
            background: activeTab === 'config' ? 'var(--gold)' : 'none',
            color: activeTab === 'config' ? 'var(--bg)' : 'var(--text)',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 600,
            transition: 'all 0.2s'
          }}
        >
          ⚙️ Configuración General
        </button>
        <button 
          onClick={() => {
            setActiveTab('requests');
          }} 
          className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
          style={{
            padding: '0.6rem 1.2rem',
            background: activeTab === 'requests' ? 'var(--gold)' : 'none',
            color: activeTab === 'requests' ? 'var(--bg)' : 'var(--text)',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 600,
            transition: 'all 0.2s'
          }}
        >
          📥 Peticiones Pendientes
        </button>
        <button 
          onClick={() => {
            setActiveTab('clients');
          }} 
          className={`tab-btn ${activeTab === 'clients' ? 'active' : ''}`}
          style={{
            padding: '0.6rem 1.2rem',
            background: activeTab === 'clients' ? 'var(--gold)' : 'none',
            color: activeTab === 'clients' ? 'var(--bg)' : 'var(--text)',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 600,
            transition: 'all 0.2s'
          }}
        >
          👥 Cartera de Clientes
        </button>
      </div>

      {/* Tab Content: Configuration */}
      {activeTab === 'config' && (
        <form onSubmit={handleSaveConfig} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.8rem' }}>
          <div>
            <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', color: 'var(--gold)' }}>⚙️ Estado y Funcionamiento</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '1.2rem' }}>
              <div className="form-group">
                <label>Habilitar Sistema de Crédito *</label>
                <select 
                  value={config.credit_enabled} 
                  onChange={e => handleConfigChange('credit_enabled', e.target.value)}
                  style={{ width: '100%', padding: '0.8rem', background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px' }}
                >
                  <option value="0">Desactivado</option>
                  <option value="1">Activado</option>
                </select>
              </div>

              <div className="form-group">
                <label>Modo de Crédito (Online) *</label>
                <select 
                  value={config.credit_mode} 
                  onChange={e => handleConfigChange('credit_mode', e.target.value)}
                  style={{ width: '100%', padding: '0.8rem', background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px' }}
                >
                  <option value="free">Crédito Libre (Auto-aprobación instantánea)</option>
                  <option value="request">Petición de Crédito (Requiere aprobación del admin)</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', color: 'var(--gold)' }}>🕒 Restricciones de Horarios y Temporadas</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '1.2rem' }}>
              <div className="form-group">
                <label>Modo de Disponibilidad de Crédito</label>
                <select 
                  value={config.credit_schedule_mode} 
                  onChange={e => handleConfigChange('credit_schedule_mode', e.target.value)}
                  style={{ width: '100%', padding: '0.8rem', background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px' }}
                >
                  <option value="always">Siempre Disponible</option>
                  <option value="hours">Por Horario y Días de la Semana</option>
                  <option value="dates">Por Temporada (Rango de Fechas)</option>
                  <option value="mixed">Mixto (Días/Horas + Temporada)</option>
                </select>
              </div>
            </div>

            {(config.credit_schedule_mode === 'hours' || config.credit_schedule_mode === 'mixed') && (
              <div style={{ background: 'var(--bg3)', padding: '1.2rem', borderRadius: '6px', border: '1px solid var(--border)', marginTop: '1.2rem' }}>
                <h4 style={{ margin: '0 0 1rem 0' }}>Horas de Actividad</h4>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.2rem' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Hora de Inicio</label>
                    <input 
                      type="time" 
                      value={config.credit_schedule_start || '08:00'} 
                      onChange={e => handleConfigChange('credit_schedule_start', e.target.value)}
                      style={{ width: '100%', padding: '0.8rem', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px' }}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Hora de Fin</label>
                    <input 
                      type="time" 
                      value={config.credit_schedule_end || '18:00'} 
                      onChange={e => handleConfigChange('credit_schedule_end', e.target.value)}
                      style={{ width: '100%', padding: '0.8rem', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px' }}
                    />
                  </div>
                </div>

                <h4 style={{ margin: '0 0 0.8rem 0' }}>Días Permitidos</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                  {['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map((dayName, idx) => {
                    const days = config.credit_schedule_days ? config.credit_schedule_days.split(',').filter(Boolean).map(Number) : [];
                    const isChecked = days.includes(idx);
                    return (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => handleDayToggle(idx)}
                        style={{
                          padding: '0.5rem 1rem',
                          borderRadius: '20px',
                          border: '1px solid var(--gold)',
                          background: isChecked ? 'var(--gold)' : 'none',
                          color: isChecked ? 'var(--bg)' : 'var(--gold)',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.8rem'
                        }}
                      >
                        {dayName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {(config.credit_schedule_mode === 'dates' || config.credit_schedule_mode === 'mixed') && (
              <div style={{ background: 'var(--bg3)', padding: '1.2rem', borderRadius: '6px', border: '1px solid var(--border)', marginTop: '1.2rem' }}>
                <h4 style={{ margin: '0 0 1rem 0' }}>Fechas de Temporada Activa</h4>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Fecha de Inicio</label>
                    <input 
                      type="date" 
                      value={config.credit_season_start || ''} 
                      onChange={e => handleConfigChange('credit_season_start', e.target.value)}
                      style={{ width: '100%', padding: '0.8rem', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px' }}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Fecha de Expiración</label>
                    <input 
                      type="date" 
                      value={config.credit_season_end || ''} 
                      onChange={e => handleConfigChange('credit_season_end', e.target.value)}
                      style={{ width: '100%', padding: '0.8rem', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px' }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', color: 'var(--gold)' }}>💎 Programa de Fidelización (Puntos y Límites)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginTop: '1.2rem' }}>
              <div className="form-group">
                <label>Puntos de Fidelidad por $ gastado</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  value={config.loyalty_points_per_dollar}
                  onChange={e => handleConfigChange('loyalty_points_per_dollar', e.target.value)}
                  style={{ width: '100%', padding: '0.8rem', background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px' }}
                />
              </div>

              <div className="form-group">
                <label>Multiplicador (Límite Crédito = Puntos * Multiplicador)</label>
                <input 
                  type="number" 
                  step="0.1"
                  min="0.1"
                  value={config.loyalty_points_to_credit_multiplier}
                  onChange={e => handleConfigChange('loyalty_points_to_credit_multiplier', e.target.value)}
                  style={{ width: '100%', padding: '0.8rem', background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px' }}
                />
              </div>

              <div className="form-group">
                <label>Puntos Mínimos requeridos para activar Crédito</label>
                <input 
                  type="number" 
                  min="0"
                  value={config.loyalty_min_points_for_credit}
                  onChange={e => handleConfigChange('loyalty_min_points_for_credit', e.target.value)}
                  style={{ width: '100%', padding: '0.8rem', background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px' }}
                />
              </div>

              <div className="form-group">
                <label>Puntos de Bienvenida (Iniciales)</label>
                <input 
                  type="number" 
                  min="0"
                  value={config.loyalty_initial_points}
                  onChange={e => handleConfigChange('loyalty_initial_points', e.target.value)}
                  style={{ width: '100%', padding: '0.8rem', background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px' }}
                />
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
            <button 
              type="submit" 
              className="btn-primary" 
              style={{ padding: '0.8rem 2rem', fontSize: '0.95rem' }} 
              disabled={savingConfig}
            >
              {savingConfig ? 'Guardando Ajustes...' : '💾 Guardar Configuración'}
            </button>
          </div>
        </form>
      )}

      {/* Tab Content: Requests */}
      {activeTab === 'requests' && (
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.2rem', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Buscar por cliente u orden..."
              value={requestSearch}
              onChange={e => setRequestSearch(e.target.value)}
              style={{ flex: '1 1 300px', padding: '0.8rem', background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
            />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ flex: '1 1 200px', padding: '0.8rem', background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
            >
              <option value="all">Todos los Estados</option>
              <option value="pending">Pendientes</option>
              <option value="approved">Aprobados</option>
              <option value="rejected">Rechazados</option>
            </select>
          </div>

          {loadingRequests ? (
            <div className="table-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Cargando peticiones...
            </div>
          ) : filteredRequests.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '3rem 1.5rem', 
              background: 'var(--bg2)', 
              border: '1px solid var(--border)', 
              borderRadius: 'var(--radius)', 
              color: 'var(--text-muted)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}>
              <span style={{ fontSize: '2.5rem' }}>📥</span>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>No se encontraron peticiones de crédito</span>
              <span style={{ fontSize: '0.85rem' }}>Las solicitudes enviadas por clientes se mostrarán aquí para su aprobación.</span>
            </div>
          ) : (
            <div className="table-card">
              <table>
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th>Cliente</th>
                    <th>Monto Solicitado</th>
                    <th>Historial de Cuenta</th>
                    <th>Fecha Solicitud</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map(r => {
                    const limit = r.credit_limit || 0;
                    const used = r.credit_used || 0;
                    const avail = limit - used;
                    return (
                      <tr key={r.id}>
                        <td>
                          <strong style={{ color: 'var(--gold)' }}>{r.order_number}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total: ${r.order_total?.toFixed(2)}</div>
                        </td>
                        <td>
                          <div>{r.customer_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Teléfono: {r.customer_phone || '—'}</div>
                        </td>
                        <td style={{ fontWeight: 'bold' }}>
                          ${r.amount?.toFixed(2)}
                        </td>
                        <td style={{ fontSize: '0.8rem' }}>
                          <div>Límite: ${limit.toFixed(2)}</div>
                          <div>Disponible: ${avail.toFixed(2)}</div>
                          <div style={{ color: 'var(--text-muted)' }}>Puntos: {r.loyalty_points || 0} pts</div>
                        </td>
                        <td>
                          {new Date(r.created_at).toLocaleString('es-VE')}
                        </td>
                        <td>
                          <span className={`status-badge ${
                            r.status === 'approved' ? 'status-paid' : 
                            r.status === 'rejected' ? 'status-cancelled' : 'status-pending'
                          }`}>
                            {r.status === 'approved' ? 'Aprobado' : 
                             r.status === 'rejected' ? 'Rechazado' : 'Pendiente'}
                          </span>
                        </td>
                        <td>
                          {r.status === 'pending' ? (
                            <button 
                              onClick={() => {
                                setResolvingRequest(r);
                                setResolutionStatus('approved');
                                setResolutionNotes('');
                              }}
                              className="btn-primary" 
                              style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}
                            >
                              Resolver ⚖️
                            </button>
                          ) : (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {r.admin_notes || 'Sin observaciones.'}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Clients List */}
      {activeTab === 'clients' && (
        <div>
          <div style={{ marginBottom: '1.2rem' }}>
            <input
              type="text"
              placeholder="Buscar por nombre, cédula, correo o teléfono..."
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              style={{ width: '100%', padding: '0.8rem', background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
            />
          </div>

          <div style={{ marginBottom: '1rem', padding: '0.8rem 1.2rem', background: 'rgba(243, 156, 18, 0.1)', border: '1px solid rgba(243, 156, 18, 0.3)', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--gold)', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <span>💡</span>
            <span><strong>Instrucciones:</strong> Haz clic en el nombre o en la deuda de cualquier cliente para desplegar su expediente de crédito completo, origen de deudas, abonos y realizar ajustes.</span>
          </div>

          <div className="table-card">
            {loadingClients ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Cargando cartera de clientes...</div>
            ) : (
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 'auto' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', color: 'var(--gold)', fontWeight: 700 }}>Cliente</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'right', color: 'var(--gold)', fontWeight: 700 }}>Deuda Actual</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.length === 0 ? (
                    <tr>
                      <td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        No se encontraron clientes.
                      </td>
                    </tr>
                  ) : (
                    filteredClients.map(c => {
                      return (
                        <tr 
                          key={c.user_id}
                          onClick={() => handleViewClientDetails(c)}
                          style={{ 
                            cursor: 'pointer', 
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <td style={{ padding: '1rem 1.5rem' }} className="allow-wrap">
                            <div style={{ fontWeight: 'bold', color: 'var(--text)', fontSize: '0.95rem' }}>{c.full_name}</div>
                            {c.email && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{c.email}</div>}
                            {c.phone && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Tlf: {c.phone}</div>}
                          </td>
                          <td style={{ 
                            padding: '1rem 1.5rem', 
                            textAlign: 'right', 
                            fontWeight: 'bold',
                            fontSize: '1rem',
                            color: c.credit_used > 0 ? 'var(--error, #ff4d4d)' : 'var(--text)'
                          }}>
                            ${c.credit_used?.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* RESOLVE REQUEST MODAL */}
      {resolvingRequest && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            padding: '1rem',
          }}
          onClick={() => setResolvingRequest(null)}
        >
          <div 
            style={{
              background: 'var(--bg2, #121218)',
              border: '1px solid var(--border, #2d2d3a)',
              borderRadius: 'var(--radius, 12px)',
              width: '100%',
              maxWidth: '500px',
              padding: '2rem',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              maxHeight: '90vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.2rem',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.8rem', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--gold)', fontWeight: 700 }}>⚖️ Resolver Petición de Crédito</h3>
              <button 
                type="button" 
                onClick={() => setResolvingRequest(null)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.3rem', cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleResolveRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div style={{ background: 'var(--bg3)', padding: '1rem', borderRadius: '6px', fontSize: '0.9rem', border: '1px solid var(--border)' }}>
                <div><strong>Orden:</strong> {resolvingRequest.order_number}</div>
                <div><strong>Cliente:</strong> {resolvingRequest.customer_name}</div>
                <div><strong>Monto:</strong> ${resolvingRequest.amount?.toFixed(2)}</div>
                <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                  <strong>Estado Cuenta del Cliente:</strong>
                  <div>Crédito Disponible: ${( (resolvingRequest.credit_limit || 0) - (resolvingRequest.credit_used || 0) ).toFixed(2)}</div>
                </div>
              </div>

              <div className="form-group">
                <label>Resolución *</label>
                <select 
                  value={resolutionStatus}
                  onChange={e => setResolutionStatus(e.target.value as any)}
                  style={{ width: '100%', padding: '0.8rem', background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px' }}
                >
                  <option value="approved">Aprobar Pedido a Crédito</option>
                  <option value="rejected">Rechazar Pedido (Cancela orden y restaura stock)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Notas administrativas (se muestran al cliente)</label>
                <textarea 
                  value={resolutionNotes}
                  onChange={e => setResolutionNotes(e.target.value)}
                  placeholder="Ej: Aprobado bajo fianza de pago en quincena..."
                  rows={3}
                  style={{ width: '100%', padding: '0.8rem', background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', resize: 'vertical' }}
                />
              </div>

              <button 
                type="submit" 
                className="btn-primary" 
                style={{ width: '100%', justifyContent: 'center', minHeight: '44px', background: resolutionStatus === 'approved' ? '#27AE60' : '#E74C3C' }} 
                disabled={submittingAction}
              >
                {submittingAction ? 'Procesando...' : `Confirmar: ${resolutionStatus === 'approved' ? 'Aprobar' : 'Rechazar'}`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* REGISTER ABONO MODAL */}
      {modalMode === 'payment' && selectedClient && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            padding: '1rem',
          }}
          onClick={() => { setModalMode(null); setSelectedClient(null); }}
        >
          <div 
            style={{
              background: 'var(--bg2, #121218)',
              border: '1px solid var(--border, #2d2d3a)',
              borderRadius: 'var(--radius, 12px)',
              width: '100%',
              maxWidth: '500px',
              padding: '2rem',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              maxHeight: '90vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.2rem',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.8rem', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--gold)', fontWeight: 700 }}>💰 Registrar Abono a Crédito</h3>
              <button 
                type="button" 
                onClick={() => { setModalMode(null); setSelectedClient(null); }} 
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.3rem', cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleRegisterPayment} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div style={{ background: 'var(--bg3)', padding: '1rem', borderRadius: '6px', fontSize: '0.9rem', border: '1px solid var(--border)' }}>
                <div><strong>Cliente:</strong> {selectedClient.full_name}</div>
                <div><strong>Deuda Actual:</strong> <span style={{ color: 'var(--error)', fontWeight: 'bold' }}>${selectedClient.credit_used?.toFixed(2)}</span></div>
                <div><strong>Crédito Límite:</strong> ${selectedClient.credit_limit?.toFixed(2)}</div>
              </div>

              <div className="form-group">
                <label>Monto de Abono ($) *</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0.01"
                  max={selectedClient.credit_used}
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  required
                  placeholder="Ej: 50.00"
                  style={{ width: '100%', padding: '0.8rem', background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px' }}
                />
              </div>

              <div className="form-group">
                <label>Notas de Abono</label>
                <textarea 
                  value={paymentNotes}
                  onChange={e => setPaymentNotes(e.target.value)}
                  placeholder="Ej: Pago realizado en efectivo / transferencia bancaria Banesco..."
                  rows={2}
                  style={{ width: '100%', padding: '0.8rem', background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', resize: 'vertical' }}
                />
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                  💡 Nota: Registrar abonos suma puntos de buen cliente y sube el límite de crédito proporcionalmente.
                </p>
              </div>

              <button 
                type="submit" 
                className="btn-primary" 
                style={{ width: '100%', justifyContent: 'center', minHeight: '44px', background: '#27AE60' }} 
                disabled={submittingAction}
              >
                {submittingAction ? 'Registrando Abono...' : '✅ Registrar Abono'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ADJUST ACCOUNT MODAL */}
      {modalMode === 'adjust' && selectedClient && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            padding: '1rem',
          }}
          onClick={() => { setModalMode(null); setSelectedClient(null); }}
        >
          <div 
            style={{
              background: 'var(--bg2, #121218)',
              border: '1px solid var(--border, #2d2d3a)',
              borderRadius: 'var(--radius, 12px)',
              width: '100%',
              maxWidth: '500px',
              padding: '2rem',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              maxHeight: '90vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.2rem',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.8rem', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--gold)', fontWeight: 700 }}>⚙️ Ajustar Cuenta de Crédito</h3>
              <button 
                type="button" 
                onClick={() => { setModalMode(null); setSelectedClient(null); }} 
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.3rem', cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAdjustAccount} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div style={{ background: 'var(--bg3)', padding: '1rem', borderRadius: '6px', fontSize: '0.9rem', border: '1px solid var(--border)' }}>
                <div><strong>Cliente:</strong> {selectedClient.full_name}</div>
                <div><strong>Cédula:</strong> {selectedClient.id_document || '—'}</div>
                <div><strong>Deuda Consumida:</strong> ${selectedClient.credit_used?.toFixed(2)}</div>
              </div>

              <div className="form-group">
                <label>Límite de Crédito ($) *</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  value={adjustLimit}
                  onChange={e => setAdjustLimit(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.8rem', background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px' }}
                />
              </div>

              <div className="form-group">
                <label>Puntos de Fidelidad *</label>
                <input 
                  type="number" 
                  min="0"
                  value={adjustPoints}
                  onChange={e => setAdjustPoints(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.8rem', background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px' }}
                />
              </div>

              <div className="form-group">
                <label>Estado de Cuenta *</label>
                <select 
                  value={adjustStatus}
                  onChange={e => setAdjustStatus(e.target.value as any)}
                  style={{ width: '100%', padding: '0.8rem', background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px' }}
                >
                  <option value="active">Activo (Habilitado para comprar)</option>
                  <option value="suspended">Suspendido (Deuda vencida u otra razón)</option>
                  <option value="cancelled">Anulado (Acceso revocado permanentemente)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Observaciones del Ajuste</label>
                <textarea 
                  value={adjustNotes}
                  onChange={e => setAdjustNotes(e.target.value)}
                  placeholder="Ej: Cambio manual de límite por acuerdo firmado..."
                  rows={2}
                  style={{ width: '100%', padding: '0.8rem', background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', resize: 'vertical' }}
                />
              </div>

              <button 
                type="submit" 
                className="btn-primary" 
                style={{ width: '100%', justifyContent: 'center', minHeight: '44px' }} 
                disabled={submittingAction}
              >
                {submittingAction ? 'Aplicando Ajustes...' : '⚙️ Aplicar Ajustes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CLIENT DETAILED VIEW MODAL */}
      {detailClient && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2500,
            padding: '1rem',
          }}
          onClick={() => setDetailClient(null)}
        >
          <div 
            style={{
              background: 'var(--bg2, #121218)',
              border: '1px solid var(--border, #2d2d3a)',
              borderRadius: 'var(--radius, 12px)',
              width: '100%',
              maxWidth: '700px',
              padding: '2rem',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              maxHeight: '90vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.8rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--gold)', fontWeight: 700 }}>
                👤 Expediente de Crédito: {detailClient.full_name}
              </h3>
              <button 
                type="button" 
                onClick={() => setDetailClient(null)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.3rem', cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            {/* Profile Info & Credit Status Summary Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.2rem' }}>
              {/* Profile details */}
              <div style={{ background: 'var(--bg3, #1e1e28)', padding: '1.2rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 0.8rem 0', color: 'var(--gold)', fontSize: '0.95rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.4rem' }}>
                  Datos de Contacto
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Cédula/Documento:</strong> {detailClient.id_document || 'No registrada'}</div>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Correo:</strong> {detailClient.email || 'No registrado'}</div>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Teléfono:</strong> {detailClient.phone || 'No registrado'}</div>
                </div>
              </div>

              {/* Credit details */}
              <div style={{ background: 'var(--bg3, #1e1e28)', padding: '1.2rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 0.8rem 0', color: 'var(--gold)', fontSize: '0.95rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.4rem' }}>
                  Resumen de Crédito
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Límite de Crédito:</span>
                    <strong style={{ color: 'var(--text)' }}>${detailClient.credit_limit?.toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Deuda Actual:</span>
                    <strong style={{ color: detailClient.credit_used > 0 ? 'var(--error, #ff4d4d)' : 'var(--text)' }}>
                      ${detailClient.credit_used?.toFixed(2)}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Crédito Disponible:</span>
                    <strong style={{ color: 'var(--success, #27ae60)' }}>
                      ${Math.max(0, detailClient.credit_limit - detailClient.credit_used).toFixed(2)}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Puntos Acumulados:</span>
                    <strong style={{ color: 'var(--gold)' }}>{detailClient.loyalty_points} pts</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Estado:</span>
                    <span className={`status-badge ${
                      detailClient.credit_status === 'active' ? 'status-paid' : 
                      detailClient.credit_status === 'suspended' ? 'status-pending' : 'status-cancelled'
                    }`} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
                      {detailClient.credit_status === 'active' ? 'Activo' : 
                       detailClient.credit_status === 'suspended' ? 'Suspendido' : 'Anulado'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px dashed var(--border)', display: 'flex', flexWrap: 'wrap', gap: '0.8rem', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => {
                  if (detailClient.credit_used <= 0) {
                    showToast('ℹ️ Este cliente no tiene deuda pendiente a la cual abonar.', 'info');
                    return;
                  }
                  setSelectedClient(detailClient);
                  setPaymentAmount('');
                  setPaymentNotes('');
                  setModalMode('payment');
                }}
                className="btn-primary" 
                style={{ 
                  fontSize: '0.85rem', 
                  padding: '0.6rem 1.2rem', 
                  background: detailClient.credit_used <= 0 ? 'rgba(255, 255, 255, 0.05)' : '#27ae60', 
                  border: '1px solid',
                  borderColor: detailClient.credit_used <= 0 ? 'rgba(255, 255, 255, 0.1)' : '#27ae60', 
                  color: detailClient.credit_used <= 0 ? 'rgba(255, 255, 255, 0.4)' : '#fff', 
                  cursor: 'pointer' 
                }}
              >
                Registrar Abono 💰
              </button>
              <button 
                onClick={() => {
                  setSelectedClient(detailClient);
                  setAdjustLimit(String(detailClient.credit_limit));
                  setAdjustPoints(String(detailClient.loyalty_points));
                  setAdjustStatus(detailClient.credit_status);
                  setAdjustNotes('');
                  setModalMode('adjust');
                }}
                className="btn-primary" 
                style={{ fontSize: '0.85rem', padding: '0.6rem 1.2rem', background: 'var(--bg3)', borderColor: 'var(--border)', color: 'var(--text)', cursor: 'pointer' }}
              >
                Ajustar Cuenta ⚙️
              </button>
            </div>

            {/* Credit History (Donde viene la deuda) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <h4 style={{ margin: 0, color: 'var(--gold)', fontSize: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                📜 Historial de Crédito (Origen de la Deuda)
              </h4>

              {loadingDetails ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Cargando movimientos...
                </div>
              ) : (!detailCreditHistory || detailCreditHistory.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem', background: 'var(--bg3)', borderRadius: '8px' }}>
                  No hay movimientos registrados para este cliente.
                </div>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <table style={{ margin: 0, fontSize: '0.85rem', width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg3)', zIndex: 10 }}>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '0.6rem 1rem', textAlign: 'left' }}>Fecha</th>
                        <th style={{ padding: '0.6rem 1rem', textAlign: 'left' }}>Tipo</th>
                        <th style={{ padding: '0.6rem 1rem', textAlign: 'right' }}>Monto</th>
                        <th style={{ padding: '0.6rem 1rem', textAlign: 'left' }}>Detalles / Notas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detailCreditHistory || []).map((h, i) => {
                        let badgeColor = '#ff4d4d'; // default red
                        let typeText = 'Compra';
                        if (h.movement_type === 'payment') {
                          badgeColor = '#27ae60';
                          typeText = 'Abono';
                        } else if (h.movement_type === 'adjustment') {
                          badgeColor = 'var(--gold)';
                          typeText = 'Ajuste';
                        }
                        
                        return (
                          <tr key={h.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '0.6rem 1rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                              {h.created_at ? `${new Date(h.created_at).toLocaleDateString('es-VE')} ${new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—'}
                            </td>
                            <td style={{ padding: '0.6rem 1rem' }}>
                              <span style={{ 
                                display: 'inline-block', 
                                padding: '0.15rem 0.4rem', 
                                borderRadius: '4px', 
                                fontSize: '0.75rem', 
                                fontWeight: 'bold',
                                color: '#000',
                                background: badgeColor
                              }}>
                                {typeText}
                              </span>
                            </td>
                            <td style={{ 
                              padding: '0.6rem 1rem', 
                              textAlign: 'right', 
                              fontWeight: 'bold',
                              color: h.amount_change > 0 ? '#ff4d4d' : h.amount_change < 0 ? '#27ae60' : 'var(--text)'
                            }}>
                              {h.amount_change > 0 ? `+$${h.amount_change.toFixed(2)}` : h.amount_change < 0 ? `-$${Math.abs(h.amount_change).toFixed(2)}` : '—'}
                            </td>
                            <td style={{ padding: '0.6rem 1rem', color: 'var(--text)' }}>
                              <div style={{ fontWeight: '500' }}>{h.reference_id}</div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{h.notes}</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            {/* Loyalty points history */}
            {detailLoyaltyHistory && detailLoyaltyHistory.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '0.5rem' }}>
                <h4 style={{ margin: 0, color: 'var(--gold)', fontSize: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                  💎 Historial de Puntos
                </h4>
                <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <table style={{ margin: 0, fontSize: '0.85rem', width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg3)', zIndex: 10 }}>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '0.6rem 1rem', textAlign: 'left' }}>Fecha</th>
                        <th style={{ padding: '0.6rem 1rem', textAlign: 'right' }}>Puntos</th>
                        <th style={{ padding: '0.6rem 1rem', textAlign: 'left' }}>Concepto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailLoyaltyHistory.map((lh, i) => (
                        <tr key={lh.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '0.6rem 1rem', color: 'var(--text-muted)' }}>
                            {new Date(lh.created_at).toLocaleDateString('es-VE')}
                          </td>
                          <td style={{ 
                            padding: '0.6rem 1rem', 
                            textAlign: 'right', 
                            fontWeight: 'bold',
                            color: lh.points_change >= 0 ? 'var(--success, #27ae60)' : 'var(--error, #ff4d4d)'
                          }}>
                            {lh.points_change >= 0 ? `+${lh.points_change}` : lh.points_change} pts
                          </td>
                          <td style={{ padding: '0.6rem 1rem', color: 'var(--text-muted)' }}>
                            <div>{lh.reason}</div>
                            {lh.reference_id && <div style={{ fontSize: '0.75rem', color: 'var(--gold)' }}>Ref: {lh.reference_id}</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
