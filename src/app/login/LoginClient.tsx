'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/context/ToastContext';
import Link from 'next/link';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [fullName, setFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPassword2, setRegPassword2] = useState('');
  const [phone, setPhone] = useState('');
  const [idDocument, setIdDocument] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegPassword2, setShowRegPassword2] = useState(false);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'register') {
      setTab('register');
    } else {
      setTab('login');
    }
  }, [searchParams]);

  const redirectUrl = searchParams.get('redirect') || '/';

  const getPasswordStrength = (pwd: string) => {
    const hasMinLength = pwd.length >= 8;
    const hasLetter = /[a-zA-Z]/.test(pwd);
    const hasNumber = /\d/.test(pwd);
    
    let score = 0;
    if (pwd) {
      if (hasMinLength) score += 1;
      if (hasLetter) score += 1;
      if (hasNumber) score += 1;
    }
    
    let label = 'Débil 🛑';
    let color = '#E74C3C';
    let percent = 33;
    
    if (score === 2) {
      label = 'Media ⚠️';
      color = '#F1C40F';
      percent = 66;
    } else if (score === 3) {
      label = 'Fuerte 💪';
      color = '#2ECC71';
      percent = 100;
    }
    
    return {
      score,
      label,
      color,
      percent,
      rules: {
        minLength: hasMinLength,
        letter: hasLetter,
        number: hasNumber,
      }
    };
  };

  const strength = getPasswordStrength(regPassword);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = (await res.json()) as any;

      if (!res.ok) {
        setError(data.error || 'Ocurrió un error al iniciar sesión.');
        showToast(data.error || 'Credenciales incorrectas.', 'error');
      } else {
        showToast('¡Sesión iniciada con éxito! 🔑', 'success');
        
        // Hard reload navbar and user status by routing refresh & navigation
        router.refresh();
        if (data.user?.role === 'vendedor') {
          router.push('/pos');
        } else if (data.user?.role === 'admin') {
          router.push('/admin');
        } else {
          router.push(redirectUrl);
        }
      }
    } catch (err) {
      console.error(err);
      setError('Error de red. Inténtalo de nuevo.');
      showToast('Error de conexión.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (regPassword.length < 8 || !/[A-Za-z]/.test(regPassword) || !/\d/.test(regPassword)) {
      setError('La contraseña debe tener al menos 8 caracteres, incluyendo letras y números.');
      showToast('Contraseña insegura.', 'error');
      return;
    }

    if (regPassword !== regPassword2) {
      setError('Las contraseñas no coinciden.');
      showToast('Las contraseñas no coinciden.', 'error');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          email: regEmail,
          password: regPassword,
          phone,
          id_document: idDocument,
          address,
          city,
          state,
        }),
      });
      const data = (await res.json()) as any;

      if (!res.ok) {
        setError(data.error || 'Ocurrió un error al registrarse.');
        showToast(data.error || 'Error al crear cuenta.', 'error');
      } else {
        showToast('¡Cuenta creada e iniciada con éxito! 🎉', 'success');
        router.refresh();
        router.push(redirectUrl);
      }
    } catch (err) {
      console.error(err);
      setError('Error de red. Inténtalo de nuevo.');
      showToast('Error de conexión.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="section-inner" style={{ maxWidth: '480px', margin: '2rem auto', padding: '0 1rem' }}>
      <div className="page-hero" style={{ padding: '1.5rem 1rem', textAlign: 'center', background: 'none' }}>
        <h1 style={{ fontSize: '1.8rem' }}>👤 Mi Cuenta</h1>
        <p>Accede o crea tu cuenta en segundos</p>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem', textAlign: 'center' }}>
          {error}
        </div>
      )}

      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
          <button
            onClick={() => setTab('login')}
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            style={{
              flex: 1,
              padding: '0.8rem',
              textAlign: 'center',
              cursor: 'pointer',
              border: 'none',
              background: 'none',
              color: tab === 'login' ? 'var(--gold)' : 'var(--text-muted)',
              fontSize: '0.9rem',
              fontWeight: 600,
              borderBottom: tab === 'login' ? '2px solid var(--gold)' : '2px solid transparent',
              transition: 'all 0.2s ease',
            }}
          >
            🔑 Iniciar Sesión
          </button>
          <button
            onClick={() => setTab('register')}
            className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
            style={{
              flex: 1,
              padding: '0.8rem',
              textAlign: 'center',
              cursor: 'pointer',
              border: 'none',
              background: 'none',
              color: tab === 'register' ? 'var(--gold)' : 'var(--text-muted)',
              fontSize: '0.9rem',
              fontWeight: 600,
              borderBottom: tab === 'register' ? '2px solid var(--gold)' : '2px solid transparent',
              transition: 'all 0.2s ease',
            }}
          >
            📝 Registrarse
          </button>
        </div>

        {/* LOGIN TAB */}
        {tab === 'login' && (
          <form onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
             <div className="form-group">
               <label>Contraseña *</label>
               <div style={{ position: 'relative' }}>
                 <input
                   type={showPassword ? 'text' : 'password'}
                   value={loginPassword}
                   onChange={(e) => setLoginPassword(e.target.value)}
                   required
                   style={{ paddingRight: '2.5rem', width: '100%' }}
                 />
                 <button
                   type="button"
                   onClick={() => setShowPassword(!showPassword)}
                   style={{
                     position: 'absolute',
                     right: '10px',
                     top: '50%',
                     transform: 'translateY(-50%)',
                     background: 'none',
                     border: 'none',
                     cursor: 'pointer',
                     color: 'var(--text-muted)',
                     padding: '5px',
                     fontSize: '1rem',
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                   }}
                 >
                   {showPassword ? '👁️' : '🙈'}
                 </button>
               </div>
             </div>
            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={loading}
            >
              {loading ? 'Cargando...' : '🔑 Entrar'}
            </button>
          </form>
        )}

        {/* REGISTER TAB */}
        {tab === 'register' && (
          <form onSubmit={handleRegisterSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.8rem' }}>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>Nombre completo *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>Email *</label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                />
              </div>
               <div className="form-group">
                 <label>Contraseña * <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>(Mín. 8 caracteres, letras y números)</span></label>
                 <div style={{ position: 'relative' }}>
                   <input
                     type={showRegPassword ? 'text' : 'password'}
                     value={regPassword}
                     onChange={(e) => setRegPassword(e.target.value)}
                     required
                     minLength={8}
                     style={{ paddingRight: '2.5rem', width: '100%' }}
                   />
                   <button
                     type="button"
                     onClick={() => setShowRegPassword(!showRegPassword)}
                     style={{
                       position: 'absolute',
                       right: '10px',
                       top: '50%',
                       transform: 'translateY(-50%)',
                       background: 'none',
                       border: 'none',
                       cursor: 'pointer',
                       color: 'var(--text-muted)',
                       padding: '5px',
                       fontSize: '1rem',
                       display: 'flex',
                       alignItems: 'center',
                       justifyContent: 'center',
                     }}
                   >
                     {showRegPassword ? '👁️' : '🙈'}
                   </button>
                 </div>
                {regPassword && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ 
                        width: `${strength.percent}%`, 
                        background: strength.color, 
                        height: '100%', 
                        transition: 'all 0.3s ease' 
                      }} />
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.3rem', fontSize: '0.72rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Seguridad:</span>
                      <strong style={{ color: strength.color }}>{strength.label}</strong>
                    </div>

                    <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.72rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: strength.rules.minLength ? 'var(--success)' : 'var(--text-muted)' }}>
                        <span>{strength.rules.minLength ? '✔️' : '❌'}</span>
                        <span>Mínimo 8 caracteres</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: strength.rules.letter ? 'var(--success)' : 'var(--text-muted)' }}>
                        <span>{strength.rules.letter ? '✔️' : '❌'}</span>
                        <span>Al menos una letra</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: strength.rules.number ? 'var(--success)' : 'var(--text-muted)' }}>
                        <span>{strength.rules.number ? '✔️' : '❌'}</span>
                        <span>Al menos un número</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
               <div className="form-group">
                 <label>Confirmar contraseña *</label>
                 <div style={{ position: 'relative' }}>
                   <input
                     type={showRegPassword2 ? 'text' : 'password'}
                     value={regPassword2}
                     onChange={(e) => setRegPassword2(e.target.value)}
                     required
                     style={{ paddingRight: '2.5rem', width: '100%' }}
                   />
                   <button
                     type="button"
                     onClick={() => setShowRegPassword2(!showRegPassword2)}
                     style={{
                       position: 'absolute',
                       right: '10px',
                       top: '50%',
                       transform: 'translateY(-50%)',
                       background: 'none',
                       border: 'none',
                       cursor: 'pointer',
                       color: 'var(--text-muted)',
                       padding: '5px',
                       fontSize: '1rem',
                       display: 'flex',
                       alignItems: 'center',
                       justifyContent: 'center',
                     }}
                   >
                     {showRegPassword2 ? '👁️' : '🙈'}
                   </button>
                 </div>
               </div>
              <div className="form-group">
                <label>Teléfono</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+58 414..."
                />
              </div>
              <div className="form-group">
                <label>Cédula / RIF</label>
                <input
                  type="text"
                  value={idDocument}
                  onChange={(e) => setIdDocument(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>Dirección</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Ciudad</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Estado</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                />
              </div>
            </div>
            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
              disabled={loading}
            >
              {loading ? 'Cargando...' : '📝 Crear Cuenta'}
            </button>
          </form>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
        <Link href="/" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none' }}>
          &larr; Volver al catálogo
        </Link>
      </div>
    </div>
  );
}

export default function LoginClient() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Cargando...</div>}>
      <LoginContent />
    </Suspense>
  );
}
