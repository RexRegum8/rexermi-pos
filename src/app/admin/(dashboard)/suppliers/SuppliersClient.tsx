'use client';
import React, { useState, useEffect } from 'react';
import { useToast } from '@/context/ToastContext';
import { useRouter } from 'next/navigation';

interface Supplier {
  id: number;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

export default function SuppliersClient() {
  const { showToast } = useToast();
  const router = useRouter();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/suppliers');
      const data = (await res.json()) as any;
      if (data.success) {
        setSuppliers(data.suppliers || []);
      } else {
        showToast(data.error || 'Error al cargar proveedores.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al cargar proveedores.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const openAddModal = () => {
    setEditingSupplier(null);
    setName('');
    setContactName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setName(supplier.name || '');
    setContactName(supplier.contact_name || '');
    setEmail(supplier.email || '');
    setPhone(supplier.phone || '');
    setAddress(supplier.address || '');
    setNotes(supplier.notes || '');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSupplier(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return showToast('El nombre es obligatorio.', 'error');

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        contact_name: contactName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null
      };

      const url = editingSupplier ? `/api/admin/suppliers/${editingSupplier.id}` : '/api/admin/suppliers';
      const method = editingSupplier ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = (await res.json()) as any;
      if (res.ok) {
        showToast(editingSupplier ? '✅ Proveedor actualizado correctamente.' : '✅ Proveedor creado correctamente.', 'success');
        closeModal();
        fetchSuppliers();
        router.refresh();
      } else {
        showToast(data.error || 'Error al guardar el proveedor.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al guardar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/suppliers/${id}`, { method: 'DELETE' });
      const data = (await res.json()) as any;
      if (res.ok) {
        showToast('🗑️ Proveedor eliminado correctamente.', 'success');
        setConfirmDeleteId(null);
        fetchSuppliers();
        router.refresh();
      } else {
        showToast(data.error || 'Error al eliminar el proveedor.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al eliminar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.contact_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.phone || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '1.5rem', color: 'var(--text)', background: 'var(--bg-main)', minHeight: '100vh' }}>
      {/* Topbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--primary, var(--gold))', margin: 0 }}>🤝 Gestión de Proveedores</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.2rem 0 0 0' }}>Administra los proveedores de tus productos para control de compras y reposición de inventario.</p>
        </div>
        <button
          onClick={openAddModal}
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
          ➕ Agregar Proveedor
        </button>
      </div>

      {/* Filters and search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <input
            type="text"
            placeholder="🔍 Buscar proveedor por nombre, contacto, correo o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem 1rem',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--bg3)',
              color: 'var(--text)',
              fontSize: '0.88rem',
              outline: 'none'
            }}
          />
        </div>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {filteredSuppliers.length} proveedores registrados
        </span>
      </div>

      {/* Grid or Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          Cargando proveedores...
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', background: 'var(--bg2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          No se encontraron proveedores. Registra uno nuevo para comenzar.
        </div>
      ) : (
        <div className="table-responsive" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '1rem' }}>Nombre / Distribuidor</th>
                <th style={{ padding: '1rem' }}>Contacto Principal</th>
                <th style={{ padding: '1rem' }}>Correo</th>
                <th style={{ padding: '1rem' }}>Teléfono</th>
                <th style={{ padding: '1rem' }}>Dirección</th>
                <th style={{ padding: '1rem' }}>Notas internas</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                  <td style={{ padding: '1rem', fontWeight: 700 }}>
                    {s.name}
                  </td>
                  <td style={{ padding: '1rem' }}>{s.contact_name || '—'}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{s.email || '—'}</td>
                  <td style={{ padding: '1rem' }}>{s.phone || '—'}</td>
                  <td style={{ padding: '1rem', fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.address || ''}>
                    {s.address || '—'}
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.notes || ''}>
                    {s.notes || '—'}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => openEditModal(s)}
                        style={{
                          cursor: 'pointer',
                          background: 'rgba(212, 175, 55, 0.1)',
                          border: '1px solid var(--gold)',
                          color: 'var(--gold)',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 600
                        }}
                      >
                        ✏️ Editar
                      </button>
                      {confirmDeleteId === s.id ? (
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          <button
                            onClick={() => handleDelete(s.id)}
                            style={{
                              cursor: 'pointer',
                              background: '#E74C3C',
                              color: '#fff',
                              border: 'none',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '6px',
                              fontSize: '0.8rem',
                              fontWeight: 700
                            }}
                          >
                            ✓ Sí
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            style={{
                              cursor: 'pointer',
                              background: 'var(--bg3)',
                              color: 'var(--text)',
                              border: '1px solid var(--border)',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '6px',
                              fontSize: '0.8rem'
                            }}
                          >
                            ✕ No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(s.id)}
                          style={{
                            cursor: 'pointer',
                            background: 'rgba(231, 76, 60, 0.1)',
                            border: '1px solid var(--error)',
                            color: 'var(--error)',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 600
                          }}
                        >
                          🗑️ Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal CRUD */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '1rem'
          }}
          onClick={closeModal}
        >
          <div
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              width: '100%',
              maxWidth: '500px',
              padding: '1.5rem',
              boxShadow: 'var(--shadow)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.8rem', marginBottom: '1.2rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                {editingSupplier ? '✏️ Editar Proveedor' : '🤝 Crear Nuevo Proveedor'}
              </h3>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Nombre / Distribuidora *</label>
                <input
                  required
                  type="text"
                  placeholder="E.g. Mercado Libre S.R.L"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%', padding: '0.6rem 0.8rem', background: 'var(--bg3)',
                    border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', outline: 'none', fontSize: '0.88rem'
                  }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Nombre del Contacto</label>
                <input
                  type="text"
                  placeholder="E.g. Carlos Pérez (Vendedor)"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  style={{
                    width: '100%', padding: '0.6rem 0.8rem', background: 'var(--bg3)',
                    border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', outline: 'none', fontSize: '0.88rem'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Email</label>
                  <input
                    type="email"
                    placeholder="correo@proveedor.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: '100%', padding: '0.6rem 0.8rem', background: 'var(--bg3)',
                      border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', outline: 'none', fontSize: '0.88rem'
                    }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Teléfono</label>
                  <input
                    type="text"
                    placeholder="0412..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{
                      width: '100%', padding: '0.6rem 0.8rem', background: 'var(--bg3)',
                      border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', outline: 'none', fontSize: '0.88rem'
                    }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Dirección física/web</label>
                <input
                  type="text"
                  placeholder="E.g. Enlace web o dirección de oficina"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  style={{
                    width: '100%', padding: '0.6rem 0.8rem', background: 'var(--bg3)',
                    border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', outline: 'none', fontSize: '0.88rem'
                  }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Notas Internas / Detalles de Reposición</label>
                <textarea
                  placeholder="E.g. Tiempo de entrega estimado, cuenta bancaria, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%', padding: '0.6rem 0.8rem', background: 'var(--bg3)', resize: 'vertical',
                    border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', outline: 'none', fontSize: '0.88rem'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={closeModal}
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
                    opacity: saving ? 0.7 : 1
                  }}
                >
                  {saving ? 'Guardando...' : '💾 Guardar Proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
