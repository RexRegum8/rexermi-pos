import { dbQuery } from '@/lib/db';
import BackupPageClient from './BackupPageClient';
import AdminSistemaTabs from '@/components/AdminSistemaTabs';

export const metadata = { title: 'Respaldo — Admin Rexermi' };
export const dynamic = 'force-dynamic';

export default async function BackupPage() {
  // Read schedule and last backup from settings
  let schedule = 'daily';
  let lastBackup: string | null = null;

  try {
    const rows = await dbQuery<{ key: string; value: string }[]>(
      `SELECT key, value FROM settings WHERE key IN ('backup_schedule', 'last_backup_at')`
    );
    for (const row of rows) {
      if (row.key === 'backup_schedule') schedule = row.value;
      if (row.key === 'last_backup_at')  lastBackup = row.value;
    }
  } catch { /* first load, settings might not have these keys yet */ }

  return (
    <>
      <AdminSistemaTabs />
      <BackupPageClient initialSchedule={schedule} initialLastBackup={lastBackup} />
    </>
  );
}

