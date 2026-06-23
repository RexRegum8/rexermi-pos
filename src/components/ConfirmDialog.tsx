'use client';

import React, { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isDanger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus confirm button when opened
    confirmButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        animation: 'fadeIn 0.2s ease-out forwards',
        padding: '1rem',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--bg2, #121218)',
          border: '1px solid var(--border, #2d2d3a)',
          borderRadius: 'var(--radius, 12px)',
          width: '100%',
          maxWidth: '420px',
          padding: '1.8rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          animation: 'scaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.2rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '1.15rem',
            fontWeight: 700,
            color: isDanger ? '#E74C3C' : 'var(--gold, #D4AF37)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {isDanger ? '⚠️' : '❓'} {title}
        </h3>

        <p
          style={{
            margin: 0,
            fontSize: '0.9rem',
            color: 'var(--text, #F0EFE8)',
            lineHeight: 1.5,
            opacity: 0.9,
          }}
        >
          {message}
        </p>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.8rem',
            marginTop: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: 'transparent',
              color: 'var(--text, #F0EFE8)',
              border: '1px solid var(--border, #2d2d3a)',
              transition: 'all 0.2s ease',
              minHeight: '38px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {cancelText}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            style={{
              padding: '0.6rem 1.4rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: isDanger ? '#E74C3C' : 'var(--gold, #D4AF37)',
              color: isDanger ? '#FFFFFF' : '#000000',
              border: 'none',
              transition: 'all 0.2s ease',
              minHeight: '38px',
              boxShadow: isDanger
                ? '0 4px 12px rgba(231,76,60,0.2)'
                : '0 4px 12px rgba(212,175,55,0.2)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = 'brightness(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = 'none';
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
