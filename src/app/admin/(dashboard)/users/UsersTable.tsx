'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useToast } from '@/context/ToastContext';
import AdminSistemaTabs from '@/components/AdminSistemaTabs';

interface User {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  id_document: string | null;
  role: string;
  is_active: number;
  created_at: string;
  order_count: number;
  permissions?: string | null;
}

export default function UsersTable({ 
  initialUsers, 
  initialDuplicates,
  totalPages, 
  currentPage, 
  totalItems 
}: { 
  initialUsers: User[], 
  initialDuplicates: User[],
  totalPages: number, 
  currentPage: number, 
  totalItems: number 
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { showToast } = useToast();

  const [users, setUsers] = useState<User[]>(initialUsers);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    city: '',
    id_document: '',
    role: 'user',
    password: '',
    is_active: 1
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [permissions, setPermissions] = useState({
    admin_access: false,
    pos_access: false,
    edit_products: false,
    view_reports: false,
    manage_users: false,
    manage_credits: false
  });

  const handleRoleChange = (selectedRole: string) => {
    setFormData({ ...formData, role: selectedRole });
    if (selectedRole === 'admin') {
      setPermissions({
        admin_access: true,
        pos_access: true,
        edit_products: true,
        view_reports: true,
        manage_users: true,
        manage_credits: true
      });
    } else if (selectedRole === 'vendedor') {
      setPermissions({
        admin_access: false,
        pos_access: true,
        edit_products: false,
        view_reports: false,
        manage_users: false,
        manage_credits: false
      });
    } else if (selectedRole === 'user') {
      setPermissions({
        admin_access: false,
        pos_access: false,
        edit_products: false,
        view_reports: false,
        manage_users: false,
        manage_credits: false
      });
    }
  };

  const [loading, setLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Merge states
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [mergeUserA, setMergeUserA] = useState<User | null>(null);
  const [mergeUserB, setMergeUserB] = useState<User | null>(null);
  const [primaryUserId, setPrimaryUserId] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Local state for inputs to allow smooth typing
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [showInactive, setShowInactive] = useState(searchParams.get('showInactive') === 'true');

  const [exportLoading, setExportLoading] = useState(false);

  const handleExportCSV = () => {
    setExportLoading(true);
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (showInactive) params.set('showInactive', 'true');
    const url = `/api/admin/users/export?${params.toString()}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setExportLoading(false), 2000);
  };

  // Credit info for selected user drawer
  const [creditInfo, setCreditInfo] = useState<{
    credit_limit: number;
    used_credit: number;
    loyalty_points: number;
    credit_status: string;
  } | null>(null);
  const [loadingCredit, setLoadingCredit] = useState(false);

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  // Fetch credit info when a user is selected in the drawer
  useEffect(() => {
    if (!selectedUser) {
      setCreditInfo(null);
      return;
    }
    const fetchCredit = async () => {
      setLoadingCredit(true);
      try {
        const res = await fetch(`/api/admin/credit/clients?userId=${selectedUser.id}`);
        const data = (await res.json()) as any;
        if (data.success && data.client) {
          setCreditInfo({
            credit_limit: data.client.credit_limit ?? 0,
            used_credit: data.client.used_credit ?? 0,
            loyalty_points: data.client.loyalty_points ?? 0,
            credit_status: data.client.credit_status ?? 'active',
          });
        } else {
          setCreditInfo(null);
        }
      } catch {
        setCreditInfo(null);
      } finally {
        setLoadingCredit(false);
      }
    };
    fetchCredit();
  }, [selectedUser]);

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

  const currentSortBy = searchParams.get('sortBy') || 'date';
  const currentSortOrder = searchParams.get('sortOrder') || 'desc';

  const handleSort = (field: string) => {
    let nextOrder = 'desc';
    if (currentSortBy === field) {
      nextOrder = currentSortOrder === 'desc' ? 'asc' : 'desc';
    } else {
      nextOrder = (field === 'name' || field === 'email' || field === 'doc') ? 'asc' : 'desc';
    }
    updateURL({ sortBy: field, sortOrder: nextOrder, page: '1' });
  };

  const renderSortIndicator = (field: string) => {
    if (currentSortBy !== field) return <span style={{ opacity: 0.35, marginLeft: '0.2rem', fontSize: '0.75rem' }}>↕</span>;
    return currentSortOrder === 'asc' 
      ? <span style={{ color: 'var(--gold)', marginLeft: '0.2rem', fontSize: '0.75rem' }}>▲</span>
      : <span style={{ color: 'var(--gold)', marginLeft: '0.2rem', fontSize: '0.75rem' }}>▼</span>;
  };

  // Debounce search updates to the URL
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentSearch = searchParams.get('search') || '';
      if (searchQuery.trim() !== currentSearch.trim()) {
        updateURL({ search: searchQuery.trim(), page: '1' });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleShowInactiveChange = (val: boolean) => {
    setShowInactive(val);
    updateURL({ showInactive: val ? 'true' : null, page: '1' });
  };

  const handlePageChange = (newPage: number) => {
    updateURL({ page: String(newPage) });
  };

  const openMergeDialog = (userA: User, userB: User) => {
    setMergeUserA(userA);
    setMergeUserB(userB);
    setPrimaryUserId(userA.id);
    setIsMergeOpen(true);
  };

  // Detect duplicate groups (Cédula, Email, or Phone) - computed across duplicates whitelisted at DB level
  const duplicateGroups = useMemo(() => {
    const docGroups: Record<string, User[]> = {};
    const emailGroups: Record<string, User[]> = {};
    const phoneGroups: Record<string, User[]> = {};

    initialDuplicates.forEach(u => {
      const doc = u.id_document?.trim();
      const email = u.email?.trim().toLowerCase();
      const phone = u.phone?.trim();

      if (doc) {
        if (!docGroups[doc]) docGroups[doc] = [];
        docGroups[doc].push(u);
      }
      if (email && !email.endsWith('@pos.local')) {
        if (!emailGroups[email]) emailGroups[email] = [];
        emailGroups[email].push(u);
      }
      if (phone && phone !== '—' && phone !== '') {
        if (!phoneGroups[phone]) phoneGroups[phone] = [];
        phoneGroups[phone].push(u);
      }
    });

    const list: { type: 'document' | 'email' | 'phone'; value: string; users: User[] }[] = [];

    Object.entries(docGroups).filter(([_, g]) => g.length > 1).forEach(([value, g]) => {
      list.push({ type: 'document', value, users: g });
    });
    Object.entries(emailGroups).filter(([_, g]) => g.length > 1).forEach(([value, g]) => {
      list.push({ type: 'email', value, users: g });
    });
    Object.entries(phoneGroups).filter(([_, g]) => g.length > 1).forEach(([value, g]) => {
      list.push({ type: 'phone', value, users: g });
    });

    return list;
  }, [initialDuplicates]);

  const openAddModal = () => {
    setEditingUser(null);
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      city: '',
      id_document: '',
      role: 'user',
      password: '',
      is_active: 1
    });
    setPermissions({
      admin_access: false,
      pos_access: false,
      edit_products: false,
      view_reports: false,
      manage_users: false,
      manage_credits: false
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      full_name: user.full_name || '',
      email: user.email || '',
      phone: user.phone || '',
      city: user.city || '',
      id_document: user.id_document || '',
      role: user.role || 'user',
      password: '',
      is_active: user.is_active
    });

    let userPerms = {
      admin_access: false,
      pos_access: false,
      edit_products: false,
      view_reports: false,
      manage_users: false,
      manage_credits: false
    };
    if (user.role === 'admin') {
      userPerms = {
        admin_access: true,
        pos_access: true,
        edit_products: true,
        view_reports: true,
        manage_users: true,
        manage_credits: true
      };
    } else if (user.role === 'vendedor') {
      userPerms.pos_access = true;
    } else if (user.permissions) {
      try {
        userPerms = { ...userPerms, ...JSON.parse(user.permissions) };
      } catch (e) {
        console.error('Failed to parse user permissions', e);
      }
    }
    setPermissions(userPerms);
    setErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.full_name.trim()) {
      newErrors.full_name = 'El nombre completo es obligatorio.';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'El correo electrónico es obligatorio.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Formato de correo electrónico inválido.';
    }
    if (!editingUser) {
      if (!formData.password.trim()) {
        newErrors.password = 'La contraseña es obligatoria para nuevos usuarios.';
      } else if (formData.password.length < 8) {
        newErrors.password = 'La contraseña debe tener al menos 8 caracteres.';
      }
    } else {
      if (formData.password && formData.password.length < 8) {
        newErrors.password = 'La contraseña debe tener al menos 8 caracteres.';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      showToast('Por favor, corrija los errores en el formulario.', 'error');
      return;
    }
    setLoading(true);
    try {
      const url = editingUser ? `/api/admin/users/${editingUser.id}` : '/api/admin/users';
      const method = editingUser ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, permissions })
      });
      const data = (await res.json()) as any;
      if (res.ok) {
        showToast(`Usuario ${editingUser ? 'actualizado' : 'creado'} correctamente.`, 'success');
        closeModal();
        router.refresh();
      } else {
        showToast(data.error || 'Ocurrió un error.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al guardar el usuario.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Usuario eliminado.', 'success');
        setUsers(prev => prev.filter(u => u.id !== id));
        setConfirmDeleteId(null);
        router.refresh();
      } else {
        const data = (await res.json()) as any;
        showToast(data.error || 'Error al eliminar.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al eliminar.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async () => {
    if (!mergeUserA || !mergeUserB || !primaryUserId) return;
    const duplicateId = primaryUserId === mergeUserA.id ? mergeUserB.id : mergeUserA.id;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryUserId, duplicateUserId: duplicateId })
      });
      const data = (await res.json()) as any;
      if (res.ok) {
        showToast('Cuentas unificadas correctamente.', 'success');
        setIsMergeOpen(false);
        setMergeUserA(null);
        setMergeUserB(null);

        // Update local state reactively
        setUsers(prev => {
          const filtered = prev.filter(u => u.id !== duplicateId);
          const primaryObj = filtered.find(u => u.id === primaryUserId);
          const duplicateObj = prev.find(u => u.id === duplicateId);
          if (primaryObj && duplicateObj) {
            primaryObj.order_count = (primaryObj.order_count || 0) + (duplicateObj.order_count || 0);
            if (!primaryObj.phone) primaryObj.phone = duplicateObj.phone;
            if (!primaryObj.city) primaryObj.city = duplicateObj.city;
            if (primaryObj.email.endsWith('@pos.local') && !duplicateObj.email.endsWith('@pos.local')) {
              primaryObj.email = duplicateObj.email;
            }
          }
          return [...filtered];
        });

        router.refresh();
      } else {
        showToast(data.error || 'Error al unificar.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al unificar.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (isModalOpen) {
    return (
      <form onSubmit={handleSubmit} noValidate>
        <div className="admin-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', marginTop: '1rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 700 }}>
            {editingUser ? `✏️ Editar Usuario: ${editingUser.full_name}` : '👥 Crear Nuevo Usuario'}
          </h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {/* Card 1: Información Personal */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1.2rem', fontSize: '0.95rem' }}>📝 Información Personal</h3>
            
            <div className="form-group">
              <label htmlFor="user-fullname">Nombre Completo *</label>
              <input
                id="user-fullname"
                type="text"
                value={formData.full_name}
                onChange={e => {
                  setFormData({ ...formData, full_name: e.target.value });
                  if (errors.full_name) setErrors(prev => ({ ...prev, full_name: '' }));
                }}
                placeholder="E.g. Juan Pérez"
                style={{ borderColor: errors.full_name ? 'var(--error)' : undefined }}
              />
              {errors.full_name && <p style={{ color: 'var(--error)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.full_name}</p>}
            </div>
            
            <div className="form-group">
              <label htmlFor="user-email">Correo Electrónico *</label>
              <input
                id="user-email"
                type="email"
                value={formData.email}
                onChange={e => {
                  setFormData({ ...formData, email: e.target.value });
                  if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                }}
                placeholder="correo@ejemplo.com"
                style={{ borderColor: errors.email ? 'var(--error)' : undefined }}
              />
              {errors.email && <p style={{ color: 'var(--error)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.email}</p>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="user-iddoc">Cédula / RIF</label>
                <input
                  id="user-iddoc"
                  type="text"
                  value={formData.id_document}
                  onChange={e => setFormData({ ...formData, id_document: e.target.value })}
                  placeholder="V-12345678"
                />
              </div>
              <div className="form-group">
                <label htmlFor="user-phone">Teléfono</label>
                <input
                  id="user-phone"
                  type="text"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="04121234567"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="user-city">Ciudad</label>
              <input
                id="user-city"
                type="text"
                value={formData.city}
                onChange={e => setFormData({ ...formData, city: e.target.value })}
                placeholder="Caracas"
              />
            </div>
          </div>

          {/* Card 2: Configuración de Cuenta */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1.2rem', fontSize: '0.95rem' }}>🔑 Configuración de Cuenta</h3>

              <div className="form-group">
                <label htmlFor="user-role">Rol</label>
                <select id="user-role" value={formData.role} onChange={e => handleRoleChange(e.target.value)}>
                  <option value="user">Cliente</option>
                  <option value="vendedor">Vendedor</option>
                  <option value="admin">Administrador</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>

              <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1.2rem', marginBottom: '1.2rem' }}>
                <h4 style={{ fontSize: '0.82rem', color: 'var(--gold)', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: 0 }}>
                  🔑 Permisos específicos {formData.role !== 'custom' && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(Solo editables en Personalizado)</span>}
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                  {[
                    { key: 'pos_access', label: '🛒 Acceso al POS' },
                    { key: 'admin_access', label: '📊 Acceso a Admin' },
                    { key: 'edit_products', label: '🛍️ Gestionar Productos' },
                    { key: 'view_reports', label: '📝 Ver Reportes' },
                    { key: 'manage_users', label: '👥 Gestionar Usuarios' },
                    { key: 'manage_credits', label: '💳 Gestionar Crédito' }
                  ].map(p => (
                    <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: formData.role === 'custom' ? 'pointer' : 'not-allowed', color: formData.role === 'custom' ? 'var(--text)' : 'var(--text-muted)' }}>
                      <input
                        type="checkbox"
                        checked={(permissions as any)[p.key]}
                        disabled={formData.role !== 'custom'}
                        onChange={e => {
                          if (formData.role === 'custom') {
                            setPermissions({ ...permissions, [p.key]: e.target.checked });
                          }
                        }}
                        style={{ accentColor: 'var(--gold)', cursor: formData.role === 'custom' ? 'pointer' : 'not-allowed' }}
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="user-status">Estado</label>
                <select id="user-status" value={formData.is_active} onChange={e => setFormData({ ...formData, is_active: parseInt(e.target.value) })}>
                  <option value={1}>Activo</option>
                  <option value={0}>Inactivo</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="user-password">Contraseña {editingUser && '(Deja en blanco para no cambiar)'}</label>
                <input
                  id="user-password"
                  type={editingUser ? "text" : "password"}
                  value={formData.password}
                  onChange={e => {
                    setFormData({ ...formData, password: e.target.value });
                    if (errors.password) setErrors(prev => ({ ...prev, password: '' }));
                  }}
                  placeholder={editingUser ? "Nueva contraseña..." : "Contraseña..."}
                  style={{ borderColor: errors.password ? 'var(--error)' : undefined }}
                />
                {errors.password && <p style={{ color: 'var(--error)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.password}</p>}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button type="button" onClick={closeModal} className="btn-outline">Cancelar</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '⏳ Guardando...' : (editingUser ? '💾 Actualizar' : '✅ Crear Usuario')}
          </button>
        </div>
      </form>
    );
  }

  return (
    <>
      <div className="admin-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', marginTop: '1rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 700 }}>👥 Gestión de Usuarios</h1>
        <button onClick={openAddModal} className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
          + Agregar Usuario
        </button>
        <button
          onClick={handleExportCSV}
          disabled={exportLoading}
          style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', background: 'rgba(212,175,55,0.1)', color: 'var(--gold)', border: '1px solid rgba(212,175,55,0.4)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          {exportLoading ? '⏳' : '⬇️'} CSV
        </button>
      </div>

      <AdminSistemaTabs />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="search-bar" style={{ flex: 1, maxWidth: '400px', margin: 0 }}>
            <input
              type="text"
              placeholder="🔍 Buscar usuario por nombre, correo, cédula o teléfono..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {totalItems} usuarios encontrados
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem', color: 'var(--text)' }}>
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => handleShowInactiveChange(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--gold)' }}
            />
            Mostrar usuarios inactivos
          </label>
        </div>
      </div>

      {duplicateGroups.length > 0 && (
        <div style={{ background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 'var(--radius)', padding: '1.2rem', marginBottom: '1.5rem' }}>
          <h3 style={{ color: 'var(--error)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem', marginTop: 0 }}>
            ⚠️ Se detectaron datos duplicados en el sistema
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem', marginTop: 0 }}>
            Hay clientes con el mismo documento, correo o teléfono. Puedes editarlos o unificar sus cuentas (sus pedidos se transferirán a la cuenta principal).
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {duplicateGroups.map((group, idx) => {
              const label = group.type === 'document' ? `Cédula/RIF: ${group.value}` : group.type === 'email' ? `Correo: ${group.value}` : `Teléfono: ${group.value}`;
              return (
                <div key={idx} style={{ background: 'var(--bg3)', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
                  <div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--gold)' }}>{label}</span>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.2rem', fontSize: '0.8rem', color: 'var(--text)' }}>
                      {group.users.map(u => (
                        <span key={u.id} style={{ background: 'var(--bg2)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                          {u.full_name} (ID: {u.id}, Pedidos: {u.order_count || 0})
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select
                      defaultValue=""
                      onChange={e => {
                        const val = e.target.value;
                        if (val === 'edit-1') openEditModal(group.users[0]);
                        if (val === 'edit-2') openEditModal(group.users[1]);
                        if (val === 'merge') openMergeDialog(group.users[0], group.users[1]);
                        e.target.value = '';
                      }}
                      style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '0.8rem', cursor: 'pointer', outline: 'none' }}
                    >
                      <option value="" disabled>Seleccionar acción...</option>
                      <option value="edit-1">✏️ Editar a: {group.users[0].full_name}</option>
                      <option value="edit-2">✏️ Editar a: {group.users[1].full_name}</option>
                      {group.users.length === 2 && (
                        <option value="merge">🤝 Unificar cuentas...</option>
                      )}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="desktop-only table-card">
        <table>
          <thead>
            <tr>
              <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center' }}>Nombre {renderSortIndicator('name')}</div>
              </th>
              <th onClick={() => handleSort('email')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center' }}>Email {renderSortIndicator('email')}</div>
              </th>
              <th onClick={() => handleSort('doc')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center' }}>Cédula {renderSortIndicator('doc')}</div>
              </th>
              <th>Rol</th>
              <th>Teléfono</th>
              <th>Ciudad</th>
              <th onClick={() => handleSort('orders')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center' }}>Pedidos {renderSortIndicator('orders')}</div>
              </th>
              <th>Estado</th>
              <th onClick={() => handleSort('date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center' }}>Registrado {renderSortIndicator('date')}</div>
              </th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>
                  <strong style={{ fontSize: '0.88rem' }}>{u.full_name}</strong>
                </td>
                <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{u.email}</td>
                <td style={{ fontSize: '0.82rem' }}>{u.id_document || '—'}</td>
                <td>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    background: u.role === 'vendedor' ? 'var(--gold)' : u.role === 'admin' ? '#3498DB' : u.role === 'custom' ? '#9B59B6' : 'var(--bg3)',
                    color: u.role === 'vendedor' || u.role === 'admin' || u.role === 'custom' ? '#000' : 'var(--text)'
                  }}>
                    {u.role === 'custom' ? 'PERSONALIZADO' : (u.role ? u.role.toUpperCase() : 'CLIENTE')}
                  </span>
                </td>
                <td style={{ fontSize: '0.82rem' }}>{u.phone || '—'}</td>
                <td style={{ fontSize: '0.82rem' }}>{u.city || '—'}</td>
                <td style={{ textAlign: 'center', fontWeight: 600, color: u.order_count > 0 ? 'var(--gold)' : 'inherit' }}>
                  {u.order_count}
                </td>
                <td>
                  <span className={`status-badge ${u.is_active ? 'status-paid' : 'status-cancelled'}`}>
                    {u.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {new Date(u.created_at).toLocaleDateString('es-VE')}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => openEditModal(u)} className="tbl-action" style={{ cursor: 'pointer', border: '1px solid var(--gold)', background: 'rgba(212, 175, 55, 0.1)', color: 'var(--gold)', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                      ✏️ Editar
                    </button>
                    {confirmDeleteId === u.id ? (
                      <>
                         <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>¿Eliminar?</span>
                        <button onClick={() => handleDelete(u.id)} disabled={loading} className="tbl-action" style={{ cursor: 'pointer', border: '1px solid var(--error)', background: 'rgba(231,76,60,0.15)', color: 'var(--error)', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                          {loading ? '...' : '✓ Sí'}
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)} className="tbl-action" style={{ cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                          ✕ No
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(u.id)} className="tbl-action" style={{ cursor: 'pointer', border: '1px solid var(--error)', background: 'rgba(231, 76, 60, 0.1)', color: 'var(--error)', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem' }}>
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

      <div className="mobile-only mobile-card-grid">
        {users.map(u => (
          <div key={u.id} className="mobile-data-card" onClick={() => setSelectedUser(u)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: '0.95rem', color: 'var(--text)' }}>{u.full_name}</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{u.email}</div>
              </div>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: '0.15rem 0.4rem',
                borderRadius: '4px',
                background: u.role === 'vendedor' ? 'var(--gold)' : u.role === 'admin' ? '#3498DB' : u.role === 'custom' ? '#9B59B6' : 'var(--bg3)',
                color: u.role === 'vendedor' || u.role === 'admin' || u.role === 'custom' ? '#000' : 'var(--text)'
              }}>
                {u.role === 'custom' ? 'PERSONALIZADO' : (u.role ? u.role.toUpperCase() : 'CLIENTE')}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.8rem', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>C.I: {u.id_document || '—'}</span>
              <span className={`status-badge ${u.is_active ? 'status-paid' : 'status-cancelled'}`} style={{ transform: 'scale(0.85)', transformOrigin: 'right center' }}>
                {u.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1rem', marginBottom: '2rem' }}>
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

      {selectedUser && (
        <div className="drawer-backdrop" onClick={() => setSelectedUser(null)}>
          <div className="drawer-content" onClick={e => e.stopPropagation()}>
            <div className="drawer-handle" />
            <button className="drawer-close-btn" onClick={() => setSelectedUser(null)}>✕</button>
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.2rem', fontWeight: 700, color: 'var(--gold)' }}>👥 Detalle del Usuario</h3>
            
            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Nombre Completo</span>
              <span className="drawer-detail-value" style={{ fontSize: '1.05rem', fontWeight: 700 }}>{selectedUser.full_name}</span>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Correo Electrónico</span>
              <span className="drawer-detail-value">{selectedUser.email}</span>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Cédula / Documento</span>
              <span className="drawer-detail-value">{selectedUser.id_document || '—'}</span>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Rol</span>
              <span className="drawer-detail-value">
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  background: selectedUser.role === 'vendedor' ? 'var(--gold)' : selectedUser.role === 'admin' ? '#3498DB' : selectedUser.role === 'custom' ? '#9B59B6' : 'var(--bg3)',
                  color: selectedUser.role === 'vendedor' || selectedUser.role === 'admin' || selectedUser.role === 'custom' ? '#000' : 'var(--text)'
                }}>
                  {selectedUser.role === 'custom' ? 'PERSONALIZADO' : (selectedUser.role ? selectedUser.role.toUpperCase() : 'CLIENTE')}
                </span>
              </span>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Teléfono</span>
              <span className="drawer-detail-value">{selectedUser.phone || '—'}</span>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Ciudad</span>
              <span className="drawer-detail-value">{selectedUser.city || '—'}</span>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Cantidad de Pedidos</span>
              <span className="drawer-detail-value" style={{ fontWeight: 700, color: selectedUser.order_count > 0 ? 'var(--gold)' : 'inherit' }}>
                {selectedUser.order_count}
              </span>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Estado</span>
              <span className="drawer-detail-value">
                <span className={`status-badge ${selectedUser.is_active ? 'status-paid' : 'status-cancelled'}`}>
                  {selectedUser.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </span>
            </div>

            <div className="drawer-detail-row">
              <span className="drawer-detail-label">Registrado desde</span>
              <span className="drawer-detail-value">{new Date(selectedUser.created_at).toLocaleDateString('es-VE')}</span>
            </div>

            {/* Credit & Loyalty Info */}
            <div style={{ marginTop: '1.2rem', padding: '1rem', borderRadius: '10px', background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.2)' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--gold)', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                💳 Crédito y Puntos de Lealtad
              </div>
              {loadingCredit ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cargando...</div>
              ) : creditInfo ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  <div style={{ background: 'var(--bg3)', padding: '0.7rem', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Límite de Crédito</div>
                    <strong style={{ color: 'var(--gold)', fontSize: '0.95rem' }}>${Number(creditInfo.credit_limit).toFixed(2)}</strong>
                  </div>
                  <div style={{ background: 'var(--bg3)', padding: '0.7rem', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Crédito Usado</div>
                    <strong style={{ color: creditInfo.used_credit > 0 ? '#e74c3c' : 'var(--text)', fontSize: '0.95rem' }}>${Number(creditInfo.used_credit).toFixed(2)}</strong>
                  </div>
                  <div style={{ background: 'var(--bg3)', padding: '0.7rem', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Puntos Lealtad</div>
                    <strong style={{ color: '#9b59b6', fontSize: '0.95rem' }}>⭐ {creditInfo.loyalty_points}</strong>
                  </div>
                  <div style={{ background: 'var(--bg3)', padding: '0.7rem', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Estado</div>
                    <strong style={{ color: creditInfo.credit_status === 'active' ? '#2ecc71' : '#e74c3c', fontSize: '0.85rem', textTransform: 'capitalize' }}>
                      {creditInfo.credit_status === 'active' ? 'Activo' : creditInfo.credit_status === 'suspended' ? 'Suspendido' : creditInfo.credit_status}
                    </strong>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sin cuenta de crédito registrada.</div>
              )}
            </div>

            {/* Acciones Gigantes en el Drawer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1.8rem', paddingTop: '1.2rem', borderTop: '1px solid var(--border)' }}>
              <button 
                onClick={() => { openEditModal(selectedUser); setSelectedUser(null); }} 
                className="btn-primary" 
                style={{ width: '100%', padding: '0.8rem', fontSize: '0.9rem', justifyContent: 'center', minHeight: '44px', display: 'flex', alignItems: 'center' }}
              >
                ✏️ Editar Información
              </button>
              
              {confirmDeleteId === selectedUser.id ? (
                <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                  <button 
                    onClick={async () => { await handleDelete(selectedUser.id); setSelectedUser(null); }} 
                    disabled={loading} 
                    className="tbl-action" 
                    style={{ flex: 1, padding: '0.8rem', fontSize: '0.9rem', cursor: 'pointer', border: '1px solid var(--error)', background: 'rgba(231,76,60,0.15)', color: 'var(--error)', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {loading ? '...' : '✓ Confirmar Eliminar'}
                  </button>
                  <button 
                    onClick={() => setConfirmDeleteId(null)} 
                    className="tbl-action" 
                    style={{ flex: 1, padding: '0.8rem', fontSize: '0.9rem', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    ✕ Cancelar
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setConfirmDeleteId(selectedUser.id)} 
                  className="tbl-action" 
                  style={{ width: '100%', padding: '0.8rem', fontSize: '0.9rem', cursor: 'pointer', border: '1px solid var(--error)', background: 'rgba(231, 76, 60, 0.1)', color: 'var(--error)', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  🗑️ Eliminar Usuario
                </button>
              )}
            </div>
          </div>
        </div>
      )}



      {isMergeOpen && mergeUserA && mergeUserB && (
        <div className="modal-backdrop" onClick={() => setIsMergeOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3>🤝 Unificar Cuentas de Usuario</h3>
              <button className="close-btn" onClick={() => setIsMergeOpen(false)}>✕</button>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.2rem' }}>
                Selecciona cuál cuenta deseas conservar como la <strong>Principal</strong>. Los pedidos e información de la cuenta secundaria se fusionarán y esta última será eliminada.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: 'var(--bg3)', padding: '1rem', borderRadius: '8px', border: `1px solid ${primaryUserId === mergeUserA.id ? 'var(--gold)' : 'var(--border)'}`, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="primaryUser"
                    checked={primaryUserId === mergeUserA.id}
                    onChange={() => setPrimaryUserId(mergeUserA.id)}
                  />
                  <div>
                    <strong>{mergeUserA.full_name} (ID: {mergeUserA.id})</strong>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Email: {mergeUserA.email} | Teléfono: {mergeUserA.phone || '—'}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--gold)' }}>Pedidos: {mergeUserA.order_count || 0}</div>
                  </div>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: 'var(--bg3)', padding: '1rem', borderRadius: '8px', border: `1px solid ${primaryUserId === mergeUserB.id ? 'var(--gold)' : 'var(--border)'}`, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="primaryUser"
                    checked={primaryUserId === mergeUserB.id}
                    onChange={() => setPrimaryUserId(mergeUserB.id)}
                  />
                  <div>
                    <strong>{mergeUserB.full_name} (ID: {mergeUserB.id})</strong>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Email: {mergeUserB.email} | Teléfono: {mergeUserB.phone || '—'}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--gold)' }}>Pedidos: {mergeUserB.order_count || 0}</div>
                  </div>
                </label>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="button" onClick={() => setIsMergeOpen(false)} className="btn-secondary" style={{ flex: 1, padding: '0.8rem' }}>
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleMerge}
                  disabled={loading}
                  className="btn-primary"
                  style={{ flex: 1, padding: '0.8rem', justifyContent: 'center' }}
                >
                  {loading ? 'Procesando...' : '🤝 Confirmar Unificación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
