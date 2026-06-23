'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RecoveryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Recovery process states
  const [actionType, setActionType] = useState<'restore' | 'initialize' | 'import_excel' | null>(null);
  const [textConfirm, setTextConfirm] = useState('');
  const [checkedConfirm, setCheckedConfirm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleAction = async () => {
    if (!actionType) return;
    
    // Triple validation check
    const expectedText = 
      actionType === 'restore' ? 'RESTAURAR' : 
      actionType === 'initialize' ? 'INICIALIZAR' : 'IMPORTAR';

    if (textConfirm !== expectedText) {
      setMessage({ type: 'error', text: `Debes escribir exactamente la palabra "${expectedText}" en mayúsculas.` });
      return;
    }
    if (!checkedConfirm) {
      setMessage({ type: 'error', text: 'Debes marcar la casilla de aceptación para proceder.' });
      return;
    }
    if (actionType === 'import_excel' && !selectedFile) {
      setMessage({ type: 'error', text: 'Por favor, selecciona un archivo Excel (.xlsx) de respaldo.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      let res;
      if (actionType === 'import_excel' && selectedFile) {
        const formData = new FormData();
        formData.append('action', 'import_excel');
        formData.append('file', selectedFile);
        
        res = await fetch('/api/recovery', {
          method: 'POST',
          body: formData // Let browser set Content-Type with boundary
        });
      } else {
        res = await fetch('/api/recovery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: actionType })
        });
      }

      const data = (await res.json()) as any;
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        setTimeout(() => {
          window.location.href = '/login';
        }, 3500);
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al procesar la acción.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Ocurrió un error de red o de comunicación con el servidor.' });
    } finally {
      setLoading(false);
    }
  };

  const expectedText = 
    actionType === 'restore' ? 'RESTAURAR' : 
    actionType === 'initialize' ? 'INICIALIZAR' : 'IMPORTAR';

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0A0A0F',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      fontFamily: 'var(--font-inter), system-ui, sans-serif'
    }}>
      <div style={{
        background: '#12121A',
        border: '1.5px solid var(--gold)',
        borderRadius: '16px',
        padding: '2.5rem',
        width: '100%',
        maxWidth: '520px',
        boxShadow: '0 8px 32px rgba(212,175,55,0.15)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
        <div style={{ fontSize: '3.5rem' }}>⚠️</div>
        
        <div>
          <h2 style={{ margin: 0, color: 'var(--text)', fontSize: '1.6rem', fontWeight: 800 }}>
            Panel de Recuperación de Base de Datos
          </h2>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Se detectó que el archivo de base de datos principal <code style={{ color: 'var(--gold)' }}>database.sqlite</code> no existe o está dañado.
          </p>
        </div>

        {message && (
          <div style={{
            padding: '0.8rem 1.2rem',
            borderRadius: '8px',
            fontSize: '0.85rem',
            textAlign: 'left',
            background: message.type === 'success' ? 'rgba(46, 204, 113, 0.1)' : 'rgba(231, 76, 60, 0.1)',
            border: `1px solid ${message.type === 'success' ? '#2ecc71' : '#e74c3c'}`,
            color: message.type === 'success' ? '#2ecc71' : '#e74c3c'
          }}>
            {message.text}
          </div>
        )}

        {!actionType ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              Selecciona una de las siguientes opciones para restaurar el funcionamiento del sistema:
            </p>
            
            <button
              onClick={() => {
                setActionType('restore');
                setTextConfirm('');
                setCheckedConfirm(false);
              }}
              style={{
                padding: '1rem',
                background: 'rgba(212,175,55,0.06)',
                border: '1.5px solid var(--gold)',
                color: 'var(--gold)',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.95rem',
                textAlign: 'left',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>💾</span>
              <div>
                <div style={{ fontWeight: 'bold' }}>Restaurar desde Respaldo Seguro</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal', marginTop: '2px' }}>
                  Recuperar base de datos del Home del SO (mantiene historiales y configuraciones).
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setActionType('import_excel');
                setTextConfirm('');
                setCheckedConfirm(false);
                setSelectedFile(null);
              }}
              style={{
                padding: '1rem',
                background: 'rgba(212,175,55,0.02)',
                border: '1.5px solid var(--border)',
                color: 'var(--text)',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.95rem',
                textAlign: 'left',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>📊</span>
              <div>
                <div style={{ fontWeight: 'bold' }}>Cargar Respaldo desde Excel (.xlsx)</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal', marginTop: '2px' }}>
                  Reconstruir base de datos completa a partir de un archivo Excel de exportación.
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setActionType('initialize');
                setTextConfirm('');
                setCheckedConfirm(false);
              }}
              style={{
                padding: '1rem',
                background: 'none',
                border: '1.5px dashed var(--border)',
                color: 'var(--text-muted)',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.95rem',
                textAlign: 'left',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>✨</span>
              <div>
                <div style={{ fontWeight: 'bold' }}>Inicializar Nueva Base de Datos</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal', marginTop: '2px' }}>
                  Crear archivo en blanco e instalar esquemas. Se pierden datos anteriores, incluye Admin inicial.
                </div>
              </div>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', textAlign: 'left', background: '#171724', padding: '1.2rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--gold)' }}>
                {actionType === 'restore' ? '💾 Confirmación de Restauración' : 
                 actionType === 'import_excel' ? '📊 Reconstruir por Archivo Excel' : '✨ Confirmación de Inicialización'}
              </span>
              <button
                onClick={() => setActionType(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
              >
                ← Volver
              </button>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
              {actionType === 'restore' && 'Esta acción sobreescribirá el archivo actual con la copia del respaldo seguro en el sistema. Asegúrate de que nadie esté operando la caja en este momento.'}
              {actionType === 'import_excel' && 'Selecciona un archivo de exportación de respaldo en formato Excel (.xlsx). El sistema borrará la base de datos dañada e importará todas las tablas configuradas en el archivo.'}
              {actionType === 'initialize' && 'Esta acción creará una base de datos completamente limpia. Perderás todos tus productos, ventas y usuarios registrados. Se creará una cuenta de administrador por defecto.'}
            </p>

            {/* Excel file input */}
            {actionType === 'import_excel' && (
              <div style={{ marginTop: '0.4rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Seleccionar archivo de respaldo (.xlsx):
                </label>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text)',
                    width: '100%'
                  }}
                />
              </div>
            )}

            {/* TRIPLE CONFIRMATION SYSTEM */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  1. Escribe exactamente <strong style={{ color: 'var(--gold)' }}>{expectedText}</strong>:
                </label>
                <input
                  type="text"
                  placeholder={expectedText}
                  value={textConfirm}
                  onChange={e => setTextConfirm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: 'var(--bg3)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: '#fff',
                    outline: 'none',
                    fontSize: '0.85rem'
                  }}
                  autoComplete="off"
                />
              </div>

              <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text)' }}>
                <input
                  type="checkbox"
                  checked={checkedConfirm}
                  onChange={e => setCheckedConfirm(e.target.checked)}
                  style={{ marginTop: '2px', cursor: 'pointer' }}
                />
                <span>2. Acepto e instruyo al servidor a realizar cambios físicos e irreversibles en la base de datos.</span>
              </label>

              <button
                onClick={handleAction}
                disabled={loading || textConfirm !== expectedText || !checkedConfirm || (actionType === 'import_excel' && !selectedFile)}
                style={{
                  width: '100%',
                  padding: '0.8rem',
                  background: 'var(--gold)',
                  border: 'none',
                  color: '#000',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  marginTop: '0.4rem',
                  opacity: (loading || textConfirm !== expectedText || !checkedConfirm || (actionType === 'import_excel' && !selectedFile)) ? 0.45 : 1,
                  transition: 'opacity 0.2s'
                }}
              >
                {loading ? 'Procesando...' : `3. Ejecutar y Proceder ➔`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
