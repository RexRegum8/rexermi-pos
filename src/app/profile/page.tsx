'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/context/ToastContext';

interface UserProfile {
  full_name: string;
  email: string;
  phone: string | null;
  id_document: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const { showToast } = useToast();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [credit, setCredit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordFields, setShowPasswordFields] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/auth/profile');
        if (!res.ok) {
          if (res.status === 401) {
            router.push('/login?redirect=/profile');
            return;
          }
          throw new Error('Error al cargar perfil');
        }
        const data = (await res.json()) as any;
        if (data.success) {
          setProfile(data.user);
        }

        // Fetch credit info
        const creditRes = await fetch('/api/customer/credit');
        if (creditRes.ok) {
          const creditData = (await creditRes.json()) as any;
          if (creditData.success) {
            setCredit(creditData);
          }
        }
      } catch (err) {
        console.error(err);
        showToast('Error al cargar la información del perfil.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router, showToast]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!profile) return;
    const { name, value } = e.target;
    setProfile(prev => prev ? { ...prev, [name]: value } : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    if (showPasswordFields) {
      if (password.length < 6) {
        showToast('La nueva contraseña debe tener al menos 6 caracteres.', 'error');
        return;
      }
      if (password !== confirmPassword) {
        showToast('Las contraseñas no coinciden.', 'error');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        ...profile,
        password: showPasswordFields ? password : null
      };

      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = (await res.json()) as any;

      if (res.ok && data.success) {
        showToast('¡Perfil actualizado con éxito!', 'success');
        setPassword('');
        setConfirmPassword('');
        setShowPasswordFields(false);
        // Refresh router so navbar changes show
        router.refresh();
      } else {
        showToast(data.error || 'Error al guardar los cambios.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al actualizar perfil.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="section" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem', animation: 'spin 1.5s linear infinite' }}>🔄</div>
          <p>Cargando información del perfil...</p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </section>
    );
  }

  if (!profile) return null;

  return (
    <section className="section">
      <div className="section-inner" style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1rem' }}>
        <div className="page-hero" style={{ background: 'none', padding: '2rem 0', textAlign: 'center' }}>
          <span className="section-tag">Mi Cuenta</span>
          <h1>👤 Perfil de Usuario</h1>
          <p>Administra tus datos de contacto y dirección para envíos rápidos</p>
        </div>

        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '2rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(10px)',
          animation: 'fadeInUp 0.4s ease both'
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            
            {/* Credit and Loyalty Section */}
            {credit && credit.creditEnabled && (
              <>
                <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', fontSize: '1rem', color: 'var(--gold)', fontWeight: 700, margin: '0.5rem 0' }}>
                  💳 Línea de Crédito y Fidelidad
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.8rem', marginBottom: '1.2rem' }}>
                  <div style={{ background: 'var(--bg3)', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Límite de Crédito</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--gold)' }}>${credit.creditLimit.toFixed(2)}</div>
                  </div>
                  <div style={{ background: 'var(--bg3)', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Deuda Pendiente</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: credit.creditUsed > 0 ? 'var(--error)' : 'var(--text)' }}>${credit.creditUsed.toFixed(2)}</div>
                  </div>
                  <div style={{ background: 'var(--bg3)', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Disponible</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: credit.availableBalance > 0 ? 'var(--success)' : 'var(--text-muted)' }}>${credit.availableBalance.toFixed(2)}</div>
                  </div>
                  <div style={{ background: 'var(--bg3)', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Puntos Acumulados</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--gold)' }}>💎 {credit.loyaltyPoints} pts</div>
                  </div>
                </div>
                {credit.creditStatus !== 'active' && (
                  <div style={{
                    padding: '0.8rem 1rem',
                    borderRadius: '8px',
                    background: 'rgba(231, 76, 60, 0.1)',
                    border: '1px solid var(--error)',
                    color: 'var(--error)',
                    fontSize: '0.82rem',
                    marginBottom: '1rem',
                    textAlign: 'center',
                    fontWeight: 600
                  }}>
                    ⚠️ Tu cuenta de crédito se encuentra actualmente {credit.creditStatus === 'suspended' ? 'SUSPENDIDA' : 'ANULADA'}. Por favor contacta al soporte.
                  </div>
                )}
              </>
            )}

            {/* Basic Info Section */}
            <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', fontSize: '1rem', color: 'var(--gold)', fontWeight: 700 }}>
              📋 Información Personal
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Nombre Completo *</label>
                <input
                  type="text"
                  name="full_name"
                  value={profile.full_name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Correo Electrónico *</label>
                <input
                  type="email"
                  name="email"
                  value={profile.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Teléfono de Contacto</label>
                <input
                  type="text"
                  name="phone"
                  value={profile.phone || ''}
                  onChange={handleChange}
                  placeholder="Ej: 04125556677"
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Documento de Identidad (Cédula/RIF)</label>
                <input
                  type="text"
                  name="id_document"
                  value={profile.id_document || ''}
                  onChange={handleChange}
                  placeholder="Ej: V-12345678"
                />
              </div>
            </div>

            {/* Shipping Info Section */}
            <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', fontSize: '1rem', color: 'var(--gold)', marginTop: '1rem', fontWeight: 700 }}>
              📦 Dirección de Envíos Predeterminada
            </h3>

            <div className="form-group" style={{ margin: 0 }}>
              <label>Dirección Detallada</label>
              <textarea
                name="address"
                value={profile.address || ''}
                onChange={handleChange}
                placeholder="Calle, urbanización, edificio, apartamento..."
                rows={2}
                style={{
                  width: '100%',
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.8rem',
                  color: 'var(--text)',
                  outline: 'none',
                  fontSize: '0.9rem',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Ciudad</label>
                <input
                  type="text"
                  name="city"
                  value={profile.city || ''}
                  onChange={handleChange}
                  placeholder="Ej: Caracas"
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Estado</label>
                <input
                  type="text"
                  name="state"
                  value={profile.state || ''}
                  onChange={handleChange}
                  placeholder="Ej: Miranda"
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Código Postal</label>
                <input
                  type="text"
                  name="postal_code"
                  value={profile.postal_code || ''}
                  onChange={handleChange}
                  placeholder="Ej: 1010"
                />
              </div>
            </div>

            {/* Password Section */}
            <div style={{ marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setShowPasswordFields(!showPasswordFields)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--gold)',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: 0
                }}
              >
                {showPasswordFields ? '▼ Cancelar Cambio de Contraseña' : '▶ ¿Deseas Cambiar tu Contraseña?'}
              </button>

              {showPasswordFields && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                  marginTop: '1rem',
                  padding: '1rem',
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  animation: 'fadeInDown 0.2s ease'
                }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Nueva Contraseña (mín. 6 caracteres)</label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••"
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Confirmar Nueva Contraseña</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="••••••"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Submit Action */}
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => router.push('/my-orders')}
                className="btn-outline"
                style={{ padding: '0.75rem 1.5rem', minHeight: '44px' }}
                disabled={saving}
              >
                Volver
              </button>
              <button
                type="submit"
                className="btn-primary"
                style={{ padding: '0.75rem 2rem', minHeight: '44px' }}
                disabled={saving}
              >
                {saving ? 'Guardando...' : '💾 Guardar Cambios'}
              </button>
            </div>

          </form>
        </div>
      </div>
      
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(15px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  );
}
