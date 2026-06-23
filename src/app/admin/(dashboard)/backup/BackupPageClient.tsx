'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/context/ToastContext';

type BackupFile = { name: string; size: number; created: string };

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function BackupPageClient({
  initialSchedule,
  initialLastBackup,
}: {
  initialSchedule: string;
  initialLastBackup: string | null;
}) {
  const { showToast } = useToast();
  const [schedule, setSchedule] = useState(initialSchedule || 'daily');
  const [lastBackup, setLastBackup] = useState<string | null>(initialLastBackup);
  const [backupFiles, setBackupFiles] = useState<BackupFile[]>([]);
  const [loadingExport, setLoadingExport]       = useState(false);
  const [loadingImport, setLoadingImport]       = useState(false);
  const [loadingMigrate, setLoadingMigrate]     = useState(false);
  const [loadingSchedule, setLoadingSchedule]   = useState(false);
  const [loadingFiles, setLoadingFiles]         = useState(false);
  const [importFile, setImportFile]             = useState<File | null>(null);
  const [importResult, setImportResult]         = useState<string[] | null>(null);
  const [confirmImport, setConfirmImport]       = useState(false);
  const [confirmMigrate, setConfirmMigrate]     = useState(false);

  const fetchFiles = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const res = await fetch('/api/admin/backup/auto-check', { method: 'PUT' });
      const data = await res.json() as any;
      setBackupFiles(data.files ?? []);
    } catch { /* ignore */ }
    finally { setLoadingFiles(false); }
  }, []);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  // Listen to background backups triggered from other pages/sidebar
  useEffect(() => {
    const handleBackupTriggered = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.lastBackup) {
        setLastBackup(customEvent.detail.lastBackup);
      }
      fetchFiles();
    };

    window.addEventListener('backup-triggered', handleBackupTriggered);
    return () => window.removeEventListener('backup-triggered', handleBackupTriggered);
  }, [fetchFiles]);

  const handleExport = async () => {
    setLoadingExport(true);
    try {
      const res = await fetch('/api/admin/backup/export');
      if (!res.ok) throw new Error((await res.json() as any).error);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rexermi-backup-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setLastBackup(new Date().toISOString());
      fetchFiles();
      showToast('✅ Respaldo exportado correctamente.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Error al exportar', 'error');
    } finally { setLoadingExport(false); }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setConfirmImport(false);
    setLoadingImport(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      const res = await fetch('/api/admin/backup/import', { method: 'POST', body: fd });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.error);
      setImportResult(data.details ?? [data.message]);
      showToast(data.message, 'success');
    } catch (err: any) {
      showToast(err.message || 'Error al importar', 'error');
    } finally { setLoadingImport(false); }
  };

  const handleMigrate = async () => {
    setConfirmMigrate(false);
    setLoadingMigrate(true);
    showToast('⏳ Preparando paquete de transmigración... (puede tardar 30-60 segundos)', 'info');
    try {
      const res = await fetch('/api/admin/backup/transmigrate');
      if (!res.ok) throw new Error((await res.json() as any).error);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rexermi-transmigrate-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('✅ Paquete de transmigración descargado.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Error al crear paquete', 'error');
    } finally { setLoadingMigrate(false); }
  };

  const handleScheduleChange = async (newSchedule: string) => {
    setLoadingSchedule(true);
    try {
      const res = await fetch('/api/admin/backup/auto-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule: newSchedule }),
      });
      if (!res.ok) throw new Error((await res.json() as any).error);
      setSchedule(newSchedule);
      showToast('✅ Frecuencia de respaldo actualizada.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Error al guardar frecuencia', 'error');
    } finally { setLoadingSchedule(false); }
  };

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '1.5rem',
  };

  const scheduleLabels: Record<string, string> = {
    manual: 'Manual (solo cuando yo lo pida)',
    hourly: 'Cada hora',
    daily:  'Diario (cada 24 horas)',
    weekly: 'Semanal (cada 7 días)',
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>💾 Respaldo & Transmigración</h1>
        <p style={{ color: 'var(--text-muted)', margin: '0.3rem 0 0' }}>
          Exporta, importa y empaqueta tu tienda para moverte a otra PC o servidor.
        </p>
      </div>

      {/* Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { icon: '🕒', label: 'Último respaldo', value: lastBackup ? formatDate(lastBackup) : 'Nunca realizado', color: lastBackup ? 'var(--success)' : '#e74c3c' },
          { icon: '📅', label: 'Frecuencia actual', value: scheduleLabels[schedule] ?? schedule, color: 'var(--gold)' },
          { icon: '📁', label: 'Respaldos guardados', value: `${backupFiles.length} archivos`, color: 'var(--primary)' },
        ].map(c => (
          <div key={c.label} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '2rem' }}>{c.icon}</span>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>{c.label}</div>
              <div style={{ fontWeight: 700, color: c.color, fontSize: '0.9rem' }}>{c.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>

        {/* ── EXPORT ── */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📤 Exportar Respaldo
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.2rem', lineHeight: 1.5 }}>
            Descarga un archivo <strong>.xlsx</strong> con todos los datos: usuarios, productos, pedidos, cupones, movimientos de inventario y configuración.
          </p>
          <button
            onClick={handleExport}
            disabled={loadingExport}
            className="btn-primary"
            style={{ width: '100%', padding: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: loadingExport ? 'wait' : 'pointer' }}
          >
            {loadingExport ? '⏳ Exportando...' : '📥 Descargar Respaldo (.xlsx)'}
          </button>
        </div>

        {/* ── IMPORT ── */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📥 Importar Respaldo
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
            ⚠️ <strong>Cuidado:</strong> restaurar un respaldo reemplazará los datos actuales de las tablas importadas.
          </p>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={e => { setImportFile(e.target.files?.[0] ?? null); setImportResult(null); setConfirmImport(false); }}
            style={{ width: '100%', marginBottom: '0.8rem', fontSize: '0.85rem', color: 'var(--text)', cursor: 'pointer' }}
          />
          {importFile && (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.8rem' }}>
              📄 {importFile.name} ({formatBytes(importFile.size)})
            </p>
          )}
          {confirmImport ? (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleImport} disabled={loadingImport} style={{ flex: 1, padding: '0.75rem', background: 'rgba(231,76,60,0.15)', border: '1px solid var(--error)', borderRadius: '8px', color: 'var(--error)', fontWeight: 700, cursor: 'pointer' }}>
                {loadingImport ? '⏳...' : '✓ Sí, restaurar'}
              </button>
              <button onClick={() => setConfirmImport(false)} style={{ padding: '0.75rem 1rem', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', cursor: 'pointer' }}>
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmImport(true)}
              disabled={!importFile || loadingImport}
              style={{ width: '100%', padding: '0.75rem', background: importFile ? 'rgba(231,76,60,0.08)' : 'var(--bg3)', border: `1px solid ${importFile ? 'var(--error)' : 'var(--border)'}`, borderRadius: '8px', color: importFile ? 'var(--error)' : 'var(--text-muted)', fontWeight: 700, cursor: importFile ? 'pointer' : 'default', fontSize: '0.9rem' }}
            >
              📤 Restaurar Respaldo
            </button>
          )}
          {importResult && (
            <div style={{ marginTop: '1rem', background: 'var(--bg3)', borderRadius: '8px', padding: '0.8rem', fontSize: '0.78rem' }}>
              {importResult.map((line, i) => <div key={i} style={{ color: 'var(--text-muted)', paddingBottom: '0.2rem' }}>✓ {line}</div>)}
            </div>
          )}
        </div>

        {/* ── SCHEDULE ── */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            ⏰ Respaldo Automático
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
            El panel verifica en segundo plano (cada 5 min mientras estás en el admin) si corresponde hacer un respaldo automático y lo guarda en el servidor.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            {Object.entries(scheduleLabels).map(([val, label]) => (
              <label key={val} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer', padding: '0.6rem', borderRadius: '8px', background: schedule === val ? 'rgba(212,175,55,0.08)' : 'transparent', border: `1px solid ${schedule === val ? 'var(--gold)' : 'var(--border)'}`, transition: 'all 0.2s' }}>
                <input type="radio" name="schedule" value={val} checked={schedule === val} onChange={() => handleScheduleChange(val)} style={{ accentColor: 'var(--gold)' }} />
                <span style={{ fontSize: '0.85rem' }}>{label}</span>
              </label>
            ))}
          </div>
          {loadingSchedule && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Guardando...</p>}
        </div>

        {/* ── TRANSMIGRATE ── */}
        <div style={{ ...cardStyle, border: '1px solid rgba(212,175,55,0.3)', background: 'rgba(212,175,55,0.04)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--gold)' }}>
            🚀 Transmigrar Proyecto
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.8rem', lineHeight: 1.5 }}>
            Genera un <strong>.zip</strong> con <em>todo el código fuente</em>, la base de datos actual y scripts listos para instalar en otra PC o servidor:
          </p>
          <ul style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingLeft: '1.2rem', marginBottom: '1.2rem', lineHeight: 2 }}>
            <li><code>setup.bat</code> — Windows (doble clic para instalar y arrancar)</li>
            <li><code>setup.sh</code> — Linux / Mac</li>
            <li><code>README.md</code> — Instrucciones detalladas</li>
            <li><code>src/data/database.sqlite</code> — Todos tus datos</li>
          </ul>
          <p style={{ fontSize: '0.75rem', color: '#e74c3c', marginBottom: '1rem' }}>
            ⚠️ Puede tardar 30-60 segundos. No cierre esta pestaña.
          </p>
          {confirmMigrate ? (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleMigrate} disabled={loadingMigrate} style={{ flex: 1, padding: '0.85rem', background: 'rgba(212,175,55,0.15)', border: '1px solid var(--gold)', borderRadius: '8px', color: 'var(--gold)', fontWeight: 700, cursor: 'pointer' }}>
                {loadingMigrate ? '⏳ Empaquetando...' : '✓ Sí, crear paquete'}
              </button>
              <button onClick={() => setConfirmMigrate(false)} style={{ padding: '0.85rem 1rem', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', cursor: 'pointer' }}>
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmMigrate(true)}
              disabled={loadingMigrate}
              style={{ width: '100%', padding: '0.85rem', background: 'rgba(212,175,55,0.1)', border: '1px solid var(--gold)', borderRadius: '8px', color: 'var(--gold)', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              {loadingMigrate ? '⏳ Creando paquete...' : '🚀 Generar Paquete de Transmigración (.zip)'}
            </button>
          )}
        </div>
      </div>

      {/* Recent backups list */}
      <div style={{ ...cardStyle, marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>📋 Respaldos Automáticos Guardados</h2>
          <button onClick={fetchFiles} disabled={loadingFiles} style={{ padding: '0.4rem 0.8rem', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', cursor: 'pointer', fontSize: '0.8rem' }}>
            {loadingFiles ? '⏳' : '🔄 Actualizar'}
          </button>
        </div>
        {backupFiles.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {loadingFiles ? 'Cargando...' : 'No hay respaldos automáticos aún. Se guardarán en el servidor según la frecuencia configurada.'}
          </p>
        ) : (
          <>
            <div className="desktop-only" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                    {['Archivo', 'Tamaño', 'Fecha de creación'].map(h => (
                      <th key={h} style={{ padding: '0.6rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {backupFiles.map((f, i) => (
                    <tr key={f.name} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                      <td style={{ padding: '0.6rem 1rem' }}>
                        <code style={{ background: 'var(--bg3)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.78rem', color: 'var(--primary)' }}>
                          {f.name}
                        </code>
                      </td>
                      <td style={{ padding: '0.6rem 1rem', color: 'var(--text-muted)' }}>{formatBytes(f.size)}</td>
                      <td style={{ padding: '0.6rem 1rem', color: 'var(--text-muted)' }}>{formatDate(f.created)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {backupFiles.map(f => (
                <div key={f.name} style={{ padding: '0.8rem', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <div style={{ wordBreak: 'break-all' }}>
                    <code style={{ background: 'var(--bg2)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.78rem', color: 'var(--primary)', fontFamily: 'monospace' }}>
                      {f.name}
                    </code>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.6rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>Tamaño: {formatBytes(f.size)}</span>
                    <span>{formatDate(f.created)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
