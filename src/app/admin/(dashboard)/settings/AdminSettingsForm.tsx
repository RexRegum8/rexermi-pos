'use client';
import React, { useState, useEffect } from 'react';
import { useToast } from '@/context/ToastContext';
import { useRouter } from 'next/navigation';

interface SettingRow { key: string; value: string; label: string; group: string; }

const GROUP_LABELS: Record<string, { icon: string; title: string }> = {
  general:  { icon: '🌐', title: 'Ajustes Generales' },
  payment:  { icon: '💰', title: 'Métodos de Pago' },
  shipping: { icon: '📦', title: 'Información de Envío' },
};

// Keys rendered as color pickers
const COLOR_KEYS = [
  'primary_color', 'primary_color_light', 'primary_color_dark',
  'accent_dark', 'accent_light',
  'text_color_dark', 'text_color_light',
  'bg_color_dark', 'bg_color_light',
];

// Keys that belong to the custom "Colores del Tema" section (group = 'theme')
const THEME_KEYS_ORDER = {
  dark:  ['accent_dark',  'text_color_dark',  'bg_color_dark'],
  light: ['accent_light', 'text_color_light', 'bg_color_light'],
};

const THEME_KEY_LABELS: Record<string, string> = {
  accent_dark:      '✨ Color de acento',
  text_color_dark:  '🔤 Color del texto',
  bg_color_dark:    '🖼️ Color de fondo',
  accent_light:     '✨ Color de acento',
  text_color_light: '🔤 Color del texto',
  bg_color_light:   '🖼️ Color de fondo',
};

// Default values (fallback if setting is missing/empty)
const DEFAULTS: Record<string, string> = {
  accent_dark:      '#D4AF37',
  accent_light:     '#A88C1E',
  text_color_dark:  '#F0EFE8',
  text_color_light: '#1A1A22',
  bg_color_dark:    '#0A0A0F',
  bg_color_light:   '#F5F4EF',
  primary_color:    '#D4AF37',
};

const THEME_PRESETS = [
  { name: 'Elegancia Dorada', colors: DEFAULTS },
  { name: 'Zafiro Profundo', colors: { accent_dark: '#3498db', accent_light: '#2980b9', text_color_dark: '#ecf0f1', text_color_light: '#2c3e50', bg_color_dark: '#0B132B', bg_color_light: '#F4F6F7', primary_color: '#3498db' } },
  { name: 'Neón Cyberpunk', colors: { accent_dark: '#ff00ff', accent_light: '#d500d5', text_color_dark: '#ffffff', text_color_light: '#111111', bg_color_dark: '#050510', bg_color_light: '#fdfdfd', primary_color: '#ff00ff' } },
  { name: 'Naturaleza Orgánica', colors: { accent_dark: '#2ecc71', accent_light: '#27ae60', text_color_dark: '#f1f8e9', text_color_light: '#1b5e20', bg_color_dark: '#0a1a0f', bg_color_light: '#f0f4c3', primary_color: '#2ecc71' } },
  { name: 'Minimalista Ártico', colors: { accent_dark: '#95a5a6', accent_light: '#7f8c8d', text_color_dark: '#ffffff', text_color_light: '#333333', bg_color_dark: '#1c1e21', bg_color_light: '#ffffff', primary_color: '#95a5a6' } },
];

function ColorField({ label, keyName, value, onChange }: {
  label: string; keyName: string; value: string; onChange: (k: string, v: string) => void;
}) {
  const current = value || DEFAULTS[keyName] || '#D4AF37';
  return (
    <div style={{ marginBottom: 0 }}>
      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
        {label}
      </label>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          type="color"
          value={current}
          onChange={e => onChange(keyName, e.target.value)}
          style={{ width: '44px', height: '44px', padding: '2px', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', background: 'none', flexShrink: 0 }}
        />
        <input
          type="text"
          value={current}
          onChange={e => onChange(keyName, e.target.value)}
          style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem 0.8rem', color: 'var(--text)', fontSize: '0.85rem', outline: 'none', fontFamily: 'monospace' }}
        />
      </div>
    </div>
  );
}

export default function AdminSettingsForm({
  settings: initialSettings,
  grouped,
}: {
  settings: Record<string, string>;
  grouped: Record<string, SettingRow[]>;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [settings, setSettings] = useState({ ...initialSettings });
  const [saving, setSaving] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);

  // Dynamic payment methods state
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [loadingPMs, setLoadingPMs] = useState(true);

  // Dynamic shipping methods state
  const [shippingMethods, setShippingMethods] = useState<any[]>([]);
  const [loadingSMs, setLoadingSMs] = useState(true);

  const fetchPaymentMethods = async () => {
    try {
      const res = await fetch('/api/admin/settings/payment-methods');
      const data = (await res.json()) as any;
      if (data.success) {
        setPaymentMethods(data.paymentMethods);
      }
    } catch (err) {
      console.error('Error fetching payment methods:', err);
    } finally {
      setLoadingPMs(false);
    }
  };

  const fetchShippingMethods = async () => {
    try {
      const res = await fetch('/api/admin/settings/shipping-methods');
      const data = (await res.json()) as any;
      if (data.success) {
        setShippingMethods(data.shippingMethods);
      }
    } catch (err) {
      console.error('Error fetching shipping methods:', err);
    } finally {
      setLoadingSMs(false);
    }
  };

  useEffect(() => {
    fetchPaymentMethods();
    fetchShippingMethods();
  }, []);

  const handleChange = (key: string, value: string) => {
    setSettings(s => ({ ...s, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      const data = (await res.json()) as any;
      if (res.ok) {
        showToast('✅ Ajustes guardados correctamente.', 'success');
        router.refresh();
      } else {
        showToast(data.error || 'Error al guardar.', 'error');
      }
    } catch {
      showToast('Error de red.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* ── Standard setting groups (general / payment / shipping) ── */}
        {Object.entries(grouped).map(([group, rows]) => {
          if (group === 'payment') {
            return (
              <div key={group} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1.2rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  💰 Métodos de Pago
                </h3>
                <PaymentMethodsManager 
                  paymentMethods={paymentMethods} 
                  loading={loadingPMs} 
                  onRefresh={fetchPaymentMethods} 
                  showToast={showToast} 
                />
              </div>
            );
          }

          if (group === 'shipping') {
            return (
              <div key={group} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1.2rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  📦 Métodos de Envío
                </h3>
                <ShippingMethodsManager 
                  shippingMethods={shippingMethods} 
                  loading={loadingSMs} 
                  onRefresh={fetchShippingMethods} 
                  showToast={showToast} 
                />
              </div>
            );
          }

          if (!rows.length) return null;
          const meta = GROUP_LABELS[group] || { icon: '⚙️', title: group };

          const EXCLUDED_KEYS = ['store_open', 'store_status_mode', 'store_schedule_start', 'store_schedule_end', 'store_schedule_days', 'primary_color', 'primary_color_light', 'primary_color_dark'];
          const visibleRows = rows.filter(row => !EXCLUDED_KEYS.includes(row.key));

          return (
            <div key={group} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1.2rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {meta.icon} {meta.title}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                {visibleRows.map(row => (
                  <div key={row.key} className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ textTransform: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {row.label || row.key}
                    </label>

                    {COLOR_KEYS.includes(row.key) ? (
                      <ColorField label="" keyName={row.key} value={settings[row.key]} onChange={handleChange} />
                    ) : row.key === 'glass_blur' || row.key === 'glass_opacity' ? (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="range"
                          min={0}
                          max={row.key === 'glass_blur' ? 40 : 1}
                          step={row.key === 'glass_blur' ? 1 : 0.01}
                          value={settings[row.key] || (row.key === 'glass_blur' ? '16' : '0.88')}
                          onChange={e => handleChange(row.key, e.target.value)}
                          style={{ flex: 1, accentColor: 'var(--gold)' }}
                        />
                        <span style={{ fontWeight: 600, color: 'var(--gold)', minWidth: '40px', textAlign: 'right', fontSize: '0.88rem' }}>
                          {settings[row.key]}
                        </span>
                      </div>
                    ) : row.key === 'shipping_info' || row.key === 'payment_bank' || row.key === 'payment_other' ? (
                      <textarea
                        value={settings[row.key] || ''}
                        onChange={e => handleChange(row.key, e.target.value)}
                        rows={3}
                        style={{ resize: 'vertical', width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }}
                      />
                    ) : row.key === 'dark_mode_default' ? (
                      <select value={settings[row.key] || '1'} onChange={e => handleChange(row.key, e.target.value)} style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }}>
                        <option value="1">🌙 Modo oscuro (por defecto)</option>
                        <option value="0">☀️ Modo claro (por defecto)</option>
                      </select>
                    ) : row.key === 'dollar_rate' ? (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="text"
                          value={settings[row.key] || ''}
                          onChange={e => handleChange(row.key, e.target.value)}
                          style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem 1rem', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }}
                        />
                        <button
                          type="button"
                          onClick={async (e) => {
                            const btn = e.currentTarget;
                            btn.disabled = true;
                            const originalText = btn.innerText;
                            btn.innerText = '🔄...';
                            try {
                              const res = await fetch('/api/admin/settings/sync-bcv', { method: 'POST' });
                              const data = (await res.json()) as any;
                              if (data.success && data.rate) {
                                handleChange('dollar_rate', String(data.rate));
                                showToast(`✅ Tasa sincronizada desde BCV: ${data.rate} Bs.`, 'success');
                              } else {
                                showToast(data.error || 'Error al sincronizar.', 'error');
                              }
                            } catch {
                              showToast('Error de red al sincronizar.', 'error');
                            } finally {
                              btn.disabled = false;
                              btn.innerText = originalText;
                            }
                          }}
                          style={{
                            padding: '0 1rem',
                            background: 'rgba(212,175,55,0.1)',
                            color: 'var(--gold)',
                            border: '1px solid var(--gold)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          🔄 Sincronizar
                        </button>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={settings[row.key] || ''}
                        onChange={e => handleChange(row.key, e.target.value)}
                        style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem 1rem', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }}
                      />
                    )}
                  </div>
                ))}
              </div>

              {group === 'general' && (
                <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px dashed var(--border)' }}>
                  <h4 style={{ marginBottom: '1.2rem', fontSize: '0.9rem', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                    🏪 Operaciones y Horario de la Tienda
                  </h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.2rem' }}>
                    
                    {/* Operation Mode */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
                        Modo de Operación
                      </label>
                      <select 
                        value={settings['store_status_mode'] || 'manual'} 
                        onChange={e => handleChange('store_status_mode', e.target.value)} 
                        style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }}
                      >
                        <option value="manual">🟢 Manual (Abierta/Cerrada fijo)</option>
                        <option value="scheduled">⏰ Programado (Por horario semanal)</option>
                      </select>
                    </div>

                    {/* Manual State (only if manual mode) */}
                    {(settings['store_status_mode'] || 'manual') === 'manual' && (
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
                          Estado de la Tienda
                        </label>
                        <select 
                          value={settings['store_open'] || '1'} 
                          onChange={e => handleChange('store_open', e.target.value)} 
                          style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }}
                        >
                          <option value="1">🟢 Abierta (Recibe pedidos)</option>
                          <option value="0">🔴 Cerrada (Mantenimiento / Solo Catálogo)</option>
                        </select>
                      </div>
                    )}

                    {/* Scheduled Hours (only if scheduled mode) */}
                    {(settings['store_status_mode'] || 'manual') === 'scheduled' && (
                      <>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
                            Hora de Apertura
                          </label>
                          <input 
                            type="time" 
                            value={settings['store_schedule_start'] || '08:00'} 
                            onChange={e => handleChange('store_schedule_start', e.target.value)} 
                            style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem 1rem', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
                            Hora de Cierre
                          </label>
                          <input 
                            type="time" 
                            value={settings['store_schedule_end'] || '18:00'} 
                            onChange={e => handleChange('store_schedule_end', e.target.value)} 
                            style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem 1rem', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Scheduled Days Selection (only if scheduled mode) */}
                  {(settings['store_status_mode'] || 'manual') === 'scheduled' && (
                    <div style={{ marginTop: '1.5rem' }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.6rem', color: 'var(--text-muted)' }}>
                        Días de Operación Comercial
                      </label>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {[
                          { value: 1, label: 'Lunes' },
                          { value: 2, label: 'Martes' },
                          { value: 3, label: 'Miércoles' },
                          { value: 4, label: 'Jueves' },
                          { value: 5, label: 'Viernes' },
                          { value: 6, label: 'Sábado' },
                          { value: 0, label: 'Domingo' },
                        ].map(day => {
                          const selectedDays = (settings['store_schedule_days'] || '').split(',').filter(Boolean).map(Number);
                          const isSelected = selectedDays.includes(day.value);
                          
                          const toggleDay = () => {
                            let nextDays;
                            if (isSelected) {
                              nextDays = selectedDays.filter(d => d !== day.value);
                            } else {
                              nextDays = [...selectedDays, day.value];
                            }
                            nextDays.sort((a, b) => a - b);
                            handleChange('store_schedule_days', nextDays.join(','));
                          };

                          return (
                            <button
                              key={day.value}
                              type="button"
                              onClick={toggleDay}
                              style={{
                                padding: '0.5rem 1.1rem',
                                background: isSelected ? 'var(--gold)' : 'var(--bg3)',
                                color: isSelected ? '#000' : 'var(--text)',
                                border: isSelected ? '1px solid var(--gold)' : '1px solid var(--border)',
                                borderRadius: '20px',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                transition: 'all 0.15s ease',
                                boxShadow: isSelected ? '0 2px 8px rgba(212,175,55,0.2)' : 'none'
                              }}
                            >
                              {isSelected ? '✓ ' : ''}{day.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* ── 🎨 Colores del Tema (split dark / light) ── */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.4rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🎨 Colores del Tema
          </h3>

          {/* Theme Presets */}
          <div style={{ marginBottom: '2rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.8rem', display: 'block' }}>Presets Recomendados (haz clic para aplicar):</span>
            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
              {THEME_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSettings(s => ({ ...s, ...preset.colors }));
                    showToast(`Preset "${preset.name}" cargado. ¡Recuerda Guardar!`, 'success');
                  }}
                  style={{
                    padding: '0.6rem 1rem', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px',
                    color: 'var(--text)', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                    transition: 'border-color 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = preset.colors.accent_dark}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: preset.colors.accent_dark, display: 'inline-block' }}></span>
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>

            {/* Dark mode column */}
            <div style={{ background: '#0A0A0F', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '12px', padding: '1.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.2rem' }}>
                <span style={{ fontSize: '1.1rem' }}>🌙</span>
                <span style={{ fontWeight: 700, color: '#F0EFE8', fontSize: '0.9rem' }}>Modo Oscuro</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {THEME_KEYS_ORDER.dark.map(k => (
                  <ColorField
                    key={k}
                    label={THEME_KEY_LABELS[k]}
                    keyName={k}
                    value={settings[k]}
                    onChange={handleChange}
                  />
                ))}
              </div>
              {/* Live preview strip */}
              <div style={{ marginTop: '1.2rem', borderRadius: '10px', padding: '0.8rem 1rem', background: settings['bg_color_dark'] || '#0A0A0F', border: `1px solid ${settings['accent_dark'] || '#D4AF37'}44` }}>
                <span style={{ fontWeight: 800, color: settings['accent_dark'] || '#D4AF37', fontSize: '0.9rem', letterSpacing: 1 }}>REXERMI</span>
                <p style={{ color: settings['text_color_dark'] || '#F0EFE8', fontSize: '0.78rem', margin: '0.3rem 0 0' }}>Vista previa del texto en modo oscuro</p>
              </div>
            </div>

            {/* Light mode column */}
            <div style={{ background: '#F5F4EF', border: '1px solid rgba(168,140,30,0.25)', borderRadius: '12px', padding: '1.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.2rem' }}>
                <span style={{ fontSize: '1.1rem' }}>☀️</span>
                <span style={{ fontWeight: 700, color: '#1A1A22', fontSize: '0.9rem' }}>Modo Claro</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {THEME_KEYS_ORDER.light.map(k => (
                  <ColorField
                    key={k}
                    label={THEME_KEY_LABELS[k]}
                    keyName={k}
                    value={settings[k]}
                    onChange={handleChange}
                  />
                ))}
              </div>
              {/* Live preview strip */}
              <div style={{ marginTop: '1.2rem', borderRadius: '10px', padding: '0.8rem 1rem', background: settings['bg_color_light'] || '#F5F4EF', border: `1px solid ${settings['accent_light'] || '#A88C1E'}44` }}>
                <span style={{ fontWeight: 800, color: settings['accent_light'] || '#A88C1E', fontSize: '0.9rem', letterSpacing: 1 }}>REXERMI</span>
                <p style={{ color: settings['text_color_light'] || '#1A1A22', fontSize: '0.78rem', margin: '0.3rem 0 0' }}>Vista previa del texto en modo claro</p>
              </div>
            </div>

          </div>
        </div>

        {/* Save & Restore buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
          {confirmRestore ? (
            <>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', alignSelf: 'center' }}>¿Restaurar colores?</span>
              <button
                type="button"
                onClick={() => {
                  setConfirmRestore(false);
                  setSettings(s => ({
                    ...s,
                    accent_dark:      DEFAULTS.accent_dark,
                    accent_light:     DEFAULTS.accent_light,
                    text_color_dark:  DEFAULTS.text_color_dark,
                    text_color_light: DEFAULTS.text_color_light,
                    bg_color_dark:    DEFAULTS.bg_color_dark,
                    bg_color_light:   DEFAULTS.bg_color_light,
                    primary_color:    DEFAULTS.primary_color,
                  }));
                  showToast('Colores restaurados en el formulario. ¡No olvides Guardar!', 'success');
                }}
                style={{ padding: '0.8rem 1.5rem', background: 'rgba(212,175,55,0.1)', color: 'var(--gold)', border: '1px solid var(--gold)', borderRadius: '8px', cursor: 'pointer' }}
              >
                ✓ Sí, restaurar
              </button>
              <button
                type="button"
                onClick={() => setConfirmRestore(false)}
                style={{ padding: '0.8rem 1.5rem', background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer' }}
              >
                ✕ Cancelar
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                type="button"
                onClick={() => setConfirmRestore(true)}
                style={{ padding: '0.8rem 1.5rem', background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                🔄 Restaurar por Defecto
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '0.8rem 2.2rem',
                  background: 'var(--gold)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(212,175,55,0.25)',
                  opacity: saving ? 0.7 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.15s ease'
                }}
              >
                {saving ? 'Guardando...' : '💾 Guardar Ajustes'}
              </button>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}

// ── DYNAMIC PAYMENT METHODS MANAGER COMPONENT ──
function PaymentMethodsManager({
  paymentMethods,
  loading,
  onRefresh,
  showToast,
}: {
  paymentMethods: any[];
  loading: boolean;
  onRefresh: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState<any | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState('online');
  const [category, setCategory] = useState('mobile_payment');
  const [requiresProof, setRequiresProof] = useState(true);
  const [isActive, setIsActive] = useState(true);
  
  // Specific details
  const [details, setDetails] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Set default values when category changes
  useEffect(() => {
    if (!editingMethod) {
      setDetails({});
      if (category === 'cash' || category === 'other') {
        setRequiresProof(false);
        setType('physical');
      } else {
        setRequiresProof(true);
        setType('online');
      }
    }
  }, [category, editingMethod]);

  const openAddModal = () => {
    setEditingMethod(null);
    setName('');
    setType('online');
    setCategory('mobile_payment');
    setRequiresProof(true);
    setIsActive(true);
    setDetails({});
    setShowModal(true);
  };

  const openEditModal = (method: any) => {
    setEditingMethod(method);
    setName(method.name);
    setType(method.type);
    setCategory(method.category);
    setRequiresProof(method.requires_proof);
    setIsActive(method.is_active);
    setDetails(method.details || {});
    setShowModal(true);
  };

  const handleDetailChange = (key: string, val: string) => {
    setDetails(prev => ({ ...prev, [key]: val }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
      e.preventDefault();
      handleSave();
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return showToast('El nombre es requerido.', 'error');
    
    setSubmitting(true);
    try {
      const payload = {
        id: editingMethod?.id,
        name: name.trim(),
        type,
        category,
        details,
        requires_proof: requiresProof,
        is_active: isActive
      };

      const res = await fetch('/api/admin/settings/payment-methods', {
        method: editingMethod ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = (await res.json()) as any;
      if (res.ok) {
        showToast(editingMethod ? '✅ Método de pago actualizado.' : '✅ Método de pago creado.', 'success');
        setShowModal(false);
        onRefresh();
      } else {
        showToast(data.error || 'Error al guardar.', 'error');
      }
    } catch {
      showToast('Error de red.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este método de pago?')) return;
    try {
      const res = await fetch(`/api/admin/settings/payment-methods?id=${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('🗑️ Método de pago eliminado.', 'success');
        onRefresh();
      } else {
        showToast('Error al eliminar.', 'error');
      }
    } catch {
      showToast('Error de red.', 'error');
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'mobile_payment': return '📱 Pago Móvil';
      case 'bank':           return '🏦 Transferencia Bancaria';
      case 'wallet':         return '💳 Billetera (Binance/PayPal/Zelle)';
      case 'cash':           return '💵 Efectivo';
      default:               return '📦 Otro';
    }
  };

  return (
    <div>
      {/* Action button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.2rem' }}>
        <button
          type="button"
          onClick={openAddModal}
          style={{
            padding: '0.6rem 1.2rem',
            background: 'var(--gold)',
            color: '#000',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            boxShadow: '0 2px 10px rgba(212,175,55,0.3)'
          }}
        >
          ➕ Añadir Método de Pago
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Cargando métodos de pago...</p>
      ) : paymentMethods.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>No hay métodos de pago registrados. Añade uno para comenzar.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {paymentMethods.map(pm => (
            <div
              key={pm.id}
              style={{
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                opacity: pm.is_active ? 1 : 0.6
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                  <strong style={{ fontSize: '0.92rem' }}>{pm.name}</strong>
                  <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '12px', background: pm.type === 'online' ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.08)', color: pm.type === 'online' ? 'var(--gold)' : 'var(--text-muted)' }}>
                    {pm.type === 'online' ? 'En Línea' : 'Físico'}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {getCategoryLabel(pm.category)}
                  </span>
                  {!pm.is_active && (
                    <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(231,76,60,0.15)', color: 'var(--error)' }}>
                      Inactivo
                    </span>
                  )}
                </div>

                {/* Details Preview */}
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '0.8rem' }}>
                  {pm.category === 'mobile_payment' && (
                    <>
                      <span>📞 Telf: {pm.details.phone}</span>
                      <span>🪪 Cédula: {pm.details.id_document}</span>
                      <span>🏦 Banco: {pm.details.bank_name}</span>
                    </>
                  )}
                  {pm.category === 'bank' && (
                    <>
                      <span>🏦 Banco: {pm.details.bank_name}</span>
                      <span>💳 Cuenta: {pm.details.account_number}</span>
                      <span>👤 Titular: {pm.details.owner_name}</span>
                      <span>🪪 Cédula: {pm.details.id_document}</span>
                    </>
                  )}
                  {pm.category === 'wallet' && (
                    <>
                      <span>✉️ Email: {pm.details.email}</span>
                      {pm.details.pay_id && <span>🆔 Pay ID: {pm.details.pay_id}</span>}
                      {pm.details.wallet_address && <span>🔗 Wallet: {pm.details.wallet_address}</span>}
                    </>
                  )}
                  {(pm.category === 'cash' || pm.category === 'other') && (
                    <span>📝 Instrucciones: {pm.details.instructions}</span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => openEditModal(pm)}
                  style={{ padding: '0.4rem 0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  ✏️ Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(pm.id)}
                  style={{ padding: '0.4rem 0.8rem', background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.2)', borderRadius: '6px', color: 'var(--error)', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  🗑️ Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal Flotante (Añadir/Editar) ── */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem',
          animation: 'fadeIn 0.25s ease'
        }}>
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: '16px', padding: '1.8rem', width: '100%', maxWidth: '520px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)', position: 'relative',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <h3 style={{ margin: '0 0 1.2rem 0', fontSize: '1.1rem', color: 'var(--gold)' }}>
              {editingMethod ? '✏️ Editar Método de Pago' : '➕ Añadir Método de Pago'}
            </h3>

            <div onKeyDown={handleKeyDown} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>Nombre del Método (ej: Banesco Pago Móvil)</label>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Banesco Pago Móvil..."
                  style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.65rem 0.9rem', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>Categoría</label>
                  <select
                    value={category} onChange={e => setCategory(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.65rem', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }}
                  >
                    <option value="mobile_payment">📱 Pago Móvil</option>
                    <option value="bank">🏦 Transferencia Bancaria</option>
                    <option value="wallet">💳 Billetera Electrónica</option>
                    <option value="cash">💵 Efectivo</option>
                    <option value="other">📦 Otro</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>Tipo</label>
                  <select
                    value={type} onChange={e => setType(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.65rem', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }}
                  >
                    <option value="online">💻 En Línea (Online)</option>
                    <option value="physical">🤝 Físico (Presencial)</option>
                  </select>
                </div>
              </div>

              {/* Dynamic details fields depending on Category */}
              <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px dashed var(--border)', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--gold)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Detalles de Cobro</span>
                
                {category === 'mobile_payment' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Teléfono</label>
                        <input
                          type="text" value={details.phone || ''} onChange={e => handleDetailChange('phone', e.target.value)} required placeholder="04121234567"
                          style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem', color: 'var(--text)', fontSize: '0.82rem', outline: 'none' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cédula/RIF</label>
                        <input
                          type="text" value={details.id_document || ''} onChange={e => handleDetailChange('id_document', e.target.value)} required placeholder="V-12345678"
                          style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem', color: 'var(--text)', fontSize: '0.82rem', outline: 'none' }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Banco Emisor (Nombre o Código)</label>
                      <input
                        type="text" value={details.bank_name || ''} onChange={e => handleDetailChange('bank_name', e.target.value)} required placeholder="Banesco (0134)"
                        style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem', color: 'var(--text)', fontSize: '0.82rem', outline: 'none' }}
                      />
                    </div>
                  </>
                )}

                {category === 'bank' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Banco</label>
                        <input
                          type="text" value={details.bank_name || ''} onChange={e => handleDetailChange('bank_name', e.target.value)} required placeholder="Banco Mercantil"
                          style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem', color: 'var(--text)', fontSize: '0.82rem', outline: 'none' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cédula/RIF Titular</label>
                        <input
                          type="text" value={details.id_document || ''} onChange={e => handleDetailChange('id_document', e.target.value)} required placeholder="J-12345678"
                          style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem', color: 'var(--text)', fontSize: '0.82rem', outline: 'none' }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Número de Cuenta Bancaria</label>
                      <input
                        type="text" value={details.account_number || ''} onChange={e => handleDetailChange('account_number', e.target.value)} required placeholder="0105-xxxx-xx-xxxxxxxxxx"
                        style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem', color: 'var(--text)', fontSize: '0.82rem', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Nombre del Titular</label>
                      <input
                        type="text" value={details.owner_name || ''} onChange={e => handleDetailChange('owner_name', e.target.value)} required placeholder="Inversiones Rexermi C.A."
                        style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem', color: 'var(--text)', fontSize: '0.82rem', outline: 'none' }}
                      />
                    </div>
                  </>
                )}

                {category === 'wallet' && (
                  <>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Nombre de la Billetera (ej: Binance Pay, PayPal, Zelle)</label>
                      <input
                        type="text" value={details.wallet_name || ''} onChange={e => handleDetailChange('wallet_name', e.target.value)} required placeholder="Binance Pay"
                        style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem', color: 'var(--text)', fontSize: '0.82rem', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Correo Electrónico de la Cuenta</label>
                      <input
                        type="email" value={details.email || ''} onChange={e => handleDetailChange('email', e.target.value)} required placeholder="ejemplo@gmail.com"
                        style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem', color: 'var(--text)', fontSize: '0.82rem', outline: 'none' }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pay ID (Opcional)</label>
                        <input
                          type="text" value={details.pay_id || ''} onChange={e => handleDetailChange('pay_id', e.target.value)} placeholder="12345678"
                          style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem', color: 'var(--text)', fontSize: '0.82rem', outline: 'none' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dirección de Wallet/Enlace</label>
                        <input
                          type="text" value={details.wallet_address || ''} onChange={e => handleDetailChange('wallet_address', e.target.value)} placeholder="0xabc... o link"
                          style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem', color: 'var(--text)', fontSize: '0.82rem', outline: 'none' }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {(category === 'cash' || category === 'other') && (
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Instrucciones / Detalles de Pago</label>
                    <textarea
                      value={details.instructions || ''} onChange={e => handleDetailChange('instructions', e.target.value)} required rows={3} placeholder="Pagar en efectivo en la entrega..."
                      style={{ width: '100%', resize: 'vertical', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem', color: 'var(--text)', fontSize: '0.82rem', outline: 'none' }}
                    />
                  </div>
                )}
              </div>

              {/* requires_proof and is_active check toggles */}
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.4rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                  <input
                    type="checkbox" checked={requiresProof} onChange={e => setRequiresProof(e.target.checked)}
                    style={{ accentColor: 'var(--gold)', width: '16px', height: '16px' }}
                  />
                  <span>¿Requiere comprobante? (Capture + Ref)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                  <input
                    type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)}
                    style={{ accentColor: 'var(--gold)', width: '16px', height: '16px' }}
                  />
                  <span>Método activo</span>
                </label>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', marginTop: '1.2rem' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ padding: '0.65rem 1.2rem', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleSave()}
                  className="btn-primary"
                  disabled={submitting}
                  style={{ padding: '0.65rem 1.8rem', fontSize: '0.85rem' }}
                >
                  {submitting ? 'Guardando...' : '💾 Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── DYNAMIC SHIPPING METHODS MANAGER COMPONENT ──
function ShippingMethodsManager({
  shippingMethods,
  loading,
  onRefresh,
  showToast,
}: {
  shippingMethods: any[];
  loading: boolean;
  onRefresh: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState<any | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [cost, setCost] = useState('0');
  const [estimatedTime, setEstimatedTime] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const openAddModal = () => {
    setEditingMethod(null);
    setName('');
    setCost('0');
    setEstimatedTime('');
    setDescription('');
    setIsActive(true);
    setShowModal(true);
  };

  const openEditModal = (method: any) => {
    setEditingMethod(method);
    setName(method.name);
    setCost(String(method.cost));
    setEstimatedTime(method.estimated_time || '');
    setDescription(method.description || '');
    setIsActive(method.is_active);
    setShowModal(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
      e.preventDefault();
      handleSave();
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return showToast('El nombre es requerido.', 'error');
    if (!estimatedTime.trim()) return showToast('El tiempo estimado es requerido.', 'error');
    
    setSubmitting(true);
    try {
      const payload = {
        id: editingMethod?.id,
        name: name.trim(),
        cost: parseFloat(cost) || 0,
        estimated_time: estimatedTime.trim(),
        description: description.trim(),
        is_active: isActive
      };

      const res = await fetch('/api/admin/settings/shipping-methods', {
        method: editingMethod ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = (await res.json()) as any;
      if (res.ok) {
        showToast(editingMethod ? '✅ Método de envío actualizado.' : '✅ Método de envío creado.', 'success');
        setShowModal(false);
        onRefresh();
      } else {
        showToast(data.error || 'Error al guardar.', 'error');
      }
    } catch {
      showToast('Error de red.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este método de envío?')) return;
    try {
      const res = await fetch(`/api/admin/settings/shipping-methods?id=${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('🗑️ Método de envío eliminado.', 'success');
        onRefresh();
      } else {
        showToast('Error al eliminar.', 'error');
      }
    } catch {
      showToast('Error de red.', 'error');
    }
  };

  return (
    <div>
      {/* Action button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.2rem' }}>
        <button
          type="button"
          onClick={openAddModal}
          style={{
            padding: '0.6rem 1.2rem',
            background: 'var(--gold)',
            color: '#000',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            boxShadow: '0 2px 10px rgba(212,175,55,0.3)'
          }}
        >
          ➕ Añadir Método de Envío
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Cargando métodos de envío...</p>
      ) : shippingMethods.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>No hay métodos de envío registrados. Añade uno para comenzar.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {shippingMethods.map(sm => (
            <div
              key={sm.id}
              style={{
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                opacity: sm.is_active ? 1 : 0.6
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                  <strong style={{ fontSize: '0.92rem' }}>{sm.name}</strong>
                  <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '12px', background: sm.cost > 0 ? 'rgba(212,175,55,0.1)' : 'rgba(46,204,113,0.15)', color: sm.cost > 0 ? 'var(--gold)' : '#2ecc71' }}>
                    {sm.cost > 0 ? `$${sm.cost.toFixed(2)}` : 'Gratis'}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    ⏱️ {sm.estimated_time}
                  </span>
                  {!sm.is_active && (
                    <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(231,76,60,0.15)', color: 'var(--error)' }}>
                      Inactivo
                    </span>
                  )}
                </div>

                {sm.description && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {sm.description}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => openEditModal(sm)}
                  style={{ padding: '0.4rem 0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  ✏️ Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(sm.id)}
                  style={{ padding: '0.4rem 0.8rem', background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.2)', borderRadius: '6px', color: 'var(--error)', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  🗑️ Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal Flotante (Añadir/Editar) ── */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem',
          animation: 'fadeIn 0.25s ease'
        }}>
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: '16px', padding: '1.8rem', width: '100%', maxWidth: '520px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)', position: 'relative',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <h3 style={{ margin: '0 0 1.2rem 0', fontSize: '1.1rem', color: 'var(--gold)' }}>
              {editingMethod ? '✏️ Editar Método de Envío' : '➕ Añadir Método de Envío'}
            </h3>

            <div onKeyDown={handleKeyDown} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>Nombre del Método (ej: Zoom a Oficina)</label>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Zoom Cobro en Destino..."
                  style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.65rem 0.9rem', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>Costo (USD)</label>
                  <input
                    type="number" min="0" step="0.01" value={cost} onChange={e => setCost(e.target.value)} required placeholder="0.00"
                    style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.65rem 0.9rem', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>Tiempo Estimado</label>
                  <input
                    type="text" value={estimatedTime} onChange={e => setEstimatedTime(e.target.value)} required placeholder="Ej: 2-3 días hábiles"
                    style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.65rem 0.9rem', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>Descripción (Opcional)</label>
                <textarea
                  value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Instrucciones o detalles de envío..."
                  style={{ width: '100%', resize: 'vertical', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.65rem', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.4rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                  <input
                    type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)}
                    style={{ accentColor: 'var(--gold)', width: '16px', height: '16px' }}
                  />
                  <span>Método activo</span>
                </label>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', marginTop: '1.2rem' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ padding: '0.65rem 1.2rem', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleSave()}
                  className="btn-primary"
                  disabled={submitting}
                  style={{ padding: '0.65rem 1.8rem', fontSize: '0.85rem' }}
                >
                  {submitting ? 'Guardando...' : '💾 Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
