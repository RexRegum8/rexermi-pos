import React from 'react';
import SupportClient from './SupportClient';

export const metadata = { title: 'Soporte — Admin Rexermi' };
export const dynamic = 'force-dynamic';

export default function AdminSupportPage() {
  return (
    <>
      <div className="admin-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', marginTop: '1rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 700 }}>💬 Soporte Técnico</h1>
      </div>
      <SupportClient />
    </>
  );
}
