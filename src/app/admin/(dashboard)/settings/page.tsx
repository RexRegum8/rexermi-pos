import { dbQuery } from '@/lib/db';
import AdminSettingsForm from './AdminSettingsForm';
import AdminSistemaTabs from '@/components/AdminSistemaTabs';

export const metadata = { title: 'Ajustes — Admin Rexermi' };
export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  // GROUP BY key to prevent duplicate React keys if the DB somehow has dupes
  const rawRows = await dbQuery<{ key: string; value: string; label: string; group: string }[]>(
    'SELECT `key`, value, label, `group` FROM settings GROUP BY `key` ORDER BY `group`, id'
  );
  // JS-level dedup as a second safety layer
  const seen = new Set<string>();
  const rows = rawRows.filter(r => { if (seen.has(r.key)) return false; seen.add(r.key); return true; });

  const settings: Record<string, string> = {};
  rows.forEach(r => { settings[r.key] = r.value || ''; });

  const groups = ['general', 'payment', 'shipping'];
  const grouped: Record<string, typeof rows> = {};
  groups.forEach(g => { grouped[g] = rows.filter(r => r.group === g); });

  return (
    <>
      <div className="admin-topbar">
        <h1>⚙️ Configuración del Sistema</h1>
      </div>
      <AdminSistemaTabs />
      <AdminSettingsForm settings={settings} grouped={grouped} />
    </>
  );
}
