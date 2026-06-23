'use client';

import React, { useState, useEffect } from 'react';

interface FooterProps {
  siteName: string;
  contactEmail?: string;
  contactPhone?: string;
}

export default function Footer({ siteName, contactEmail, contactPhone }: FooterProps) {
  const currentYear = new Date().getFullYear();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <footer
        style={{
          borderTop: '1px solid var(--border)',
          background: 'var(--bg2)',
          padding: '2rem 1rem',
          textAlign: 'center',
          fontSize: '0.9rem',
          color: 'var(--text-muted)',
          marginTop: 'auto',
        }}
      >
        <div className="section-inner">
          <p style={{ marginBottom: '0.5rem' }}>
            &copy; {currentYear} <strong>{siteName}</strong>. Todos los derechos reservados.
          </p>
          {mounted && (contactEmail || contactPhone) && (
            <p style={{ fontSize: '0.82rem' }}>
              {contactEmail && `Contacto: ${contactEmail}`}
              {contactEmail && contactPhone && ' | '}
              {contactPhone && `WhatsApp: ${contactPhone}`}
            </p>
          )}
        </div>
      </footer>
    </>
  );
}
