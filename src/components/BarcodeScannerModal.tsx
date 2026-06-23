'use client';
import React, { useEffect, useRef, useState } from 'react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (code: string) => void;
}

export default function BarcodeScannerModal({ isOpen, onClose, onScanSuccess }: BarcodeScannerModalProps) {
  const [libLoaded, setLibLoaded] = useState(false);
  const [cameras, setCameras] = useState<any[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [scanError, setScanError] = useState<string>('');
  const [isStarting, setIsStarting] = useState(false);
  const html5QrCodeRef = useRef<any>(null);
  const initializedRef = useRef(false);

  // Load html5-qrcode dynamically from CDN
  useEffect(() => {
    if (!isOpen) return;
    
    if (typeof window !== 'undefined' && (window as any).Html5Qrcode) {
      setLibLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/html5-qrcode';
    script.async = true;
    script.onload = () => {
      setLibLoaded(true);
    };
    script.onerror = () => {
      setScanError('No se pudo cargar la librería del escáner desde el CDN.');
    };
    document.body.appendChild(script);

    return () => {
      // Keep it in body to avoid multiple injections
    };
  }, [isOpen]);

  // Request cameras & Initialize scanner
  useEffect(() => {
    if (!isOpen || !libLoaded) return;

    const Html5QrcodeClass = (window as any).Html5Qrcode;
    if (!Html5QrcodeClass) {
      setScanError('La librería del escáner no está inicializada.');
      return;
    }

    const startScanner = async (cameraId: string) => {
      if (isStarting) return;
      setIsStarting(true);
      setScanError('');
      
      try {
        // Stop current scanner if exists
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }

        const scanner = new Html5QrcodeClass('barcode-scanner-reader');
        html5QrCodeRef.current = scanner;

        const config = {
          fps: 15,
          qrbox: (width: number, height: number) => {
            // Rectangular box for barcodes
            const boxWidth = Math.min(width * 0.8, 320);
            const boxHeight = Math.min(height * 0.4, 160);
            return { width: boxWidth, height: boxHeight };
          },
          aspectRatio: 1.333333
        };

        await scanner.start(
          cameraId ? cameraId : { facingMode: 'environment' },
          config,
          (decodedText: string) => {
            // Play success beep
            playBeep();
            
            // Callback success
            onScanSuccess(decodedText);
            
            // Clean up and close
            stopScannerAndClose();
          },
          (errorMessage: string) => {
            // Silent error callback (fires on every frame with no barcode)
          }
        );
      } catch (err: any) {
        console.error('Error starting scanner:', err);
        setScanError(`Error al iniciar la cámara: ${err.message || err}`);
      } finally {
        setIsStarting(false);
      }
    };

    const getDevicesAndStart = async () => {
      try {
        // Request camera permissions first
        const devices = await Html5QrcodeClass.getCameras();
        setCameras(devices);
        
        if (devices.length > 0) {
          // Default to environment/back camera if found, or first camera
          const backCam = devices.find((d: any) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('trasera') || d.label.toLowerCase().includes('ambiente'));
          const defaultCamId = backCam ? backCam.id : devices[0].id;
          setSelectedCameraId(defaultCamId);
          startScanner(defaultCamId);
        } else {
          // If no label devices found, try default facingMode
          startScanner('');
        }
      } catch (err: any) {
        console.error('Error getting cameras:', err);
        // Try starting directly with facingMode: environment
        startScanner('');
      }
    };

    if (!initializedRef.current) {
      initializedRef.current = true;
      getDevicesAndStart();
    }

    return () => {
      // Component unmount cleanup
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch((e: any) => console.error('Cleanup stop failed:', e));
      }
      initializedRef.current = false;
    };
  }, [isOpen, libLoaded]);

  // Change camera handler
  const handleCameraChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const camId = e.target.value;
    setSelectedCameraId(camId);
    if (!libLoaded || !html5QrCodeRef.current) return;
    
    try {
      if (html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }
      
      const Html5QrcodeClass = (window as any).Html5Qrcode;
      const scanner = new Html5QrcodeClass('barcode-scanner-reader');
      html5QrCodeRef.current = scanner;

      await scanner.start(
        camId,
        {
          fps: 15,
          qrbox: (width: number, height: number) => {
            const boxWidth = Math.min(width * 0.8, 320);
            const boxHeight = Math.min(height * 0.4, 160);
            return { width: boxWidth, height: boxHeight };
          },
          aspectRatio: 1.333333
        },
        (decodedText: string) => {
          playBeep();
          onScanSuccess(decodedText);
          stopScannerAndClose();
        },
        () => {}
      );
    } catch (err: any) {
      console.error('Error switching camera:', err);
      setScanError(`No se pudo cambiar de cámara: ${err.message || err}`);
    }
  };

  const stopScannerAndClose = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (e) {
        console.error('Stop error:', e);
      }
    }
    onClose();
  };

  const playBeep = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
      console.warn('Scan beep failed:', e);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(10, 10, 12, 0.85)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem',
      animation: 'fadeIn 0.25s ease'
    }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes laserScan {
          0% { top: 10%; }
          50% { top: 90%; }
          100% { top: 10%; }
        }
        .scanner-container {
          background: var(--bg2, #1a1a1f);
          border: 1px solid var(--border, #d4af3733);
          border-radius: 16px;
          padding: 1.5rem;
          width: 100%;
          max-width: 480px;
          box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(212, 175, 55, 0.1);
          display: flex;
          flex-direction: column;
          gap: 1.2rem;
          position: relative;
        }
        .scanner-viewport {
          position: relative;
          width: 100%;
          aspect-ratio: 1.333333;
          border-radius: 12px;
          overflow: hidden;
          background: #000;
          border: 2px solid var(--border, #d4af3733);
        }
        .scanner-laser {
          position: absolute;
          left: 5%;
          right: 5%;
          height: 3px;
          background: linear-gradient(90deg, transparent, var(--gold, #d4af37), transparent);
          box-shadow: 0 0 8px var(--gold, #d4af37);
          z-index: 10;
          animation: laserScan 2.5s infinite linear;
          pointer-events: none;
        }
        .scanner-overlay-border {
          position: absolute;
          border: 2px solid var(--gold, #d4af37);
          width: 30px;
          height: 30px;
          pointer-events: none;
          z-index: 9;
        }
        .scanner-tl { top: 15px; left: 15px; border-right: none; border-bottom: none; }
        .scanner-tr { top: 15px; right: 15px; border-left: none; border-bottom: none; }
        .scanner-bl { bottom: 15px; left: 15px; border-right: none; border-top: none; }
        .scanner-br { bottom: 15px; right: 15px; border-left: none; border-top: none; }
        .scanner-select {
          background: var(--bg3, #121216);
          border: 1px solid var(--border, #d4af3733);
          border-radius: 8px;
          padding: 0.6rem;
          color: var(--text, #fff);
          font-size: 0.85rem;
          width: 100%;
          outline: none;
          cursor: pointer;
        }
        .scanner-select:focus {
          border-color: var(--gold, #d4af37);
        }
      `}} />

      <div className="scanner-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: 'var(--gold, #d4af37)', fontSize: '1.1rem', fontWeight: 'bold' }}>
            📷 Escanear Código de Barras
          </h3>
          <button 
            onClick={stopScannerAndClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted, #a0a0a5)',
              fontSize: '1.5rem',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '0.2rem'
            }}
            title="Cerrar"
          >
            ×
          </button>
        </div>

        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted, #a0a0a5)', lineHeight: 1.4 }}>
          Enfoque el código de barras del producto dentro de la guía central para realizar la detección automática.
        </p>

        <div className="scanner-viewport">
          <div id="barcode-scanner-reader" style={{ width: '100%', height: '100%' }}></div>
          <div className="scanner-laser" />
          <div className="scanner-overlay-border scanner-tl" />
          <div className="scanner-overlay-border scanner-tr" />
          <div className="scanner-overlay-border scanner-bl" />
          <div className="scanner-overlay-border scanner-br" />
        </div>

        {cameras.length > 1 && (
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
              Seleccionar Cámara:
            </label>
            <select 
              value={selectedCameraId} 
              onChange={handleCameraChange}
              className="scanner-select"
            >
              {cameras.map(cam => (
                <option key={cam.id} value={cam.id}>
                  {cam.label || `Cámara ${cameras.indexOf(cam) + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {scanError && (
          <div style={{
            background: 'rgba(231,76,60,0.1)',
            border: '1px solid rgba(231,76,60,0.3)',
            borderRadius: '8px',
            padding: '0.6rem 0.8rem',
            color: '#e74c3c',
            fontSize: '0.8rem',
            lineHeight: 1.4
          }}>
            {scanError}
          </div>
        )}

        <button
          onClick={stopScannerAndClose}
          className="pos-action-btn"
          style={{
            width: '100%',
            padding: '0.7rem',
            borderRadius: '8px',
            background: 'var(--bg3, #121216)',
            border: '1px solid var(--border, #d4af3733)',
            color: 'var(--text, #fff)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.85rem'
          }}
        >
          Cancelar / Cerrar
        </button>
      </div>
    </div>
  );
}
