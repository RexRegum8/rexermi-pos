'use client';

import React, { useEffect, useRef, useState } from 'react';

interface CameraScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export default function CameraScanner({ onScan, onClose }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  const toggleTorch = async () => {
    const track = trackRef.current;
    if (!track) return;
    try {
      const nextTorch = !isTorchOn;
      await track.applyConstraints({
        advanced: [{ torch: nextTorch }]
      } as any);
      setIsTorchOn(nextTorch);
    } catch (err) {
      console.error('Failed to toggle torch:', err);
    }
  };

  useEffect(() => {
    let active = true;
    let animationFrameId: number;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
        });
        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        
        const track = stream.getVideoTracks()[0];
        if (track) {
          trackRef.current = track;
          try {
            // Check torch capabilities
            const capabilities = track.getCapabilities() as any;
            if (capabilities && 'torch' in capabilities) {
              setHasTorch(true);
            }
          } catch (e) {
            console.warn('Could not read track capabilities:', e);
          }
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();
          setLoading(false);
          // Start decoding loop
          startDecoding();
        }
      } catch (err: any) {
        console.error('Error accessing camera:', err);
        setError('No se pudo acceder a la cámara. Por favor otorga permisos.');
        setLoading(false);
      }
    };

    const startDecoding = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // Check for BarcodeDetector support
      const HasBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;
      let detector: any = null;
      if (HasBarcodeDetector) {
        try {
          // @ts-ignore
          detector = new window.BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e']
          });
        } catch (e) {
          console.warn('BarcodeDetector format check failed:', e);
        }
      }

      const scanFrame = async () => {
        if (!active || video.paused || video.ended) return;

        // Draw video frame to canvas
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        if (detector) {
          try {
            const barcodes = await detector.detect(canvas);
            if (barcodes.length > 0 && active) {
              const code = barcodes[0].rawValue;
              if (code) {
                if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
                  window.navigator.vibrate(60);
                }
                onScan(code);
                active = false;
                return;
              }
            }
          } catch (err) {
            console.error('Native detector error:', err);
          }
        } else {
          // Fallback to lightweight ZXing decoder loaded from CDN
          // @ts-ignore
          if (window.ZXingBarcodeReader) {
            try {
              // @ts-ignore
              const result = window.ZXingBarcodeReader.decode(canvas);
              if (result && active) {
                if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
                  window.navigator.vibrate(60);
                }
                onScan(result.text);
                active = false;
                return;
              }
            } catch (e) {
              // Decoder throws if no barcode found in frame, ignore
            }
          }
        }

        if (active) {
          animationFrameId = requestAnimationFrame(scanFrame);
        }
      };

      // Ensure fallback script is loaded if native is not present
      if (!detector && typeof window !== 'undefined') {
        // @ts-ignore
        if (!window.ZXingBarcodeReader) {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/@zxing/library@0.19.1/umd/index.min.js';
          script.async = true;
          script.onload = () => {
            try {
              // Initialize MultiFormatReader
              // @ts-ignore
              const reader = new window.ZXing.BrowserMultiFormatReader();
              // @ts-ignore
              window.ZXingBarcodeReader = {
                decode: (canvasEl: HTMLCanvasElement) => {
                  return reader.decodeFromCanvas(canvasEl);
                }
              };
            } catch (err) {
              console.error('Failed to init ZXing:', err);
            }
          };
          document.body.appendChild(script);
        }
      }

      scanFrame();
    };

    startCamera();

    return () => {
      active = false;
      cancelAnimationFrame(animationFrameId);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [onScan]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        background: 'var(--bg2)',
        border: '1.5px solid var(--gold)',
        borderRadius: '16px',
        padding: '1.5rem',
        width: '100%',
        maxWidth: '500px',
        boxShadow: '0 8px 32px rgba(212,175,55,0.15)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        position: 'relative'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📷 Escáner de Cámara
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            {hasTorch && (
              <button
                onClick={toggleTorch}
                style={{
                  background: isTorchOn ? 'rgba(212,175,55,0.25)' : 'none',
                  border: '1px solid var(--border)',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  color: isTorchOn ? 'var(--gold)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem',
                  transition: 'all 0.2s'
                }}
                title={isTorchOn ? 'Apagar Linterna' : 'Encender Linterna'}
              >
                🔦
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '1.2rem',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {error ? (
          <div style={{ color: '#e74c3c', padding: '1rem', background: 'rgba(231,76,60,0.1)', borderRadius: '8px', fontSize: '0.9rem', textAlign: 'center' }}>
            {error}
          </div>
        ) : (
          <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', overflow: 'hidden', borderRadius: '12px', background: '#000' }}>
            {loading && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                Iniciando cámara...
              </div>
            )}
            <video
              ref={videoRef}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              muted
              playsInline
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            
            {/* Visual Guide Box Overlay */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '75%',
              height: '35%',
              border: '2px dashed var(--gold)',
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
              borderRadius: '8px',
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{
                position: 'absolute',
                width: '100%',
                height: '2px',
                background: '#ff0000',
                opacity: 0.8,
                animation: 'scanLine 2s linear infinite'
              }} />
            </div>
          </div>
        )}

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          Encuadra el código de barras del producto dentro de la guía discontinua.
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'var(--bg3)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            padding: '0.6rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
            transition: 'all 0.2s'
          }}
        >
          Cancelar
        </button>
      </div>

      <style jsx global>{`
        @keyframes scanLine {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
      `}</style>
    </div>
  );
}
