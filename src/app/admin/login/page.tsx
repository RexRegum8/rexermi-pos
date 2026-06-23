'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/context/ToastContext';

export default function AdminLoginPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as any;
      if (!res.ok) {
        showToast(data.error || 'Credenciales incorrectas.', 'error');
      } else {
        showToast('Bienvenido al panel de administración.', 'success');
        router.push('/admin');
        router.refresh();
      }
    } catch {
      showToast('Error de conexión.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔐</div>
          <h1 style={{ fontSize: '1.6rem', background: 'linear-gradient(135deg, var(--gold), var(--gold-light))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Panel Admin
          </h1>
          <p style={{ fontSize: '0.85rem' }}>Rexermi Marketplace</p>
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '2rem' }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Usuario</label>
              <input type="text" id="admin-username" value={username} onChange={e => setUsername(e.target.value)} required autoFocus autoComplete="username" />
            </div>
            <div className="form-group">
              <label>Contraseña</label>
              <input type="password" id="admin-password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }} disabled={loading}>
              {loading ? 'Verificando...' : '🔐 Ingresar al Panel'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
