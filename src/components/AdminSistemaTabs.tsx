'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/admin/users',    icon: '👥', label: 'Usuarios' },
  { href: '/admin/backup',   icon: '💾', label: 'Respaldo' },
  { href: '/admin/settings', icon: '⚙️', label: 'Ajustes' },
];

/**
 * Horizontal tab bar linking between Users, Backup and Settings pages.
 * Drop it at the top of each of those pages' content area.
 */
export default function AdminSistemaTabs() {
  const pathname = usePathname();

  return (
    <div
      style={{
        display: 'flex',
        gap: '0.25rem',
        marginBottom: '1.5rem',
        borderBottom: '1px solid var(--border)',
        overflowX: 'auto',
        paddingBottom: '0',
      }}
    >
      {TABS.map(tab => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.6rem 1.1rem',
              fontSize: '0.88rem',
              fontWeight: 600,
              textDecoration: 'none',
              color: active ? 'var(--gold)' : 'var(--text-muted)',
              borderBottom: active ? '2.5px solid var(--gold)' : '2.5px solid transparent',
              marginBottom: '-1px',
              transition: 'color 0.2s, border-color 0.2s',
              whiteSpace: 'nowrap',
              background: active ? 'rgba(212,175,55,0.07)' : 'transparent',
              borderRadius: '6px 6px 0 0',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
