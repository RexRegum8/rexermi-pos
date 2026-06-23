import { redirect } from 'next/navigation';
import { getAdminSession, getAdminPermissions } from '@/lib/auth';
import AdminSidebar from '@/components/AdminSidebar';
import { dbQuery } from '@/lib/db';
import AdminBarcodeListener from '@/components/AdminBarcodeListener';
import AdminKeyboardShortcuts from '@/components/AdminKeyboardShortcuts';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');

  const permissions = await getAdminPermissions();
  if (!permissions || !permissions.admin_access) {
    redirect('/admin/login');
  }

  let adminName = '';
  if ((session as any).isUserTable) {
    const user = await dbQuery<{ full_name: string }[]>('SELECT full_name FROM users WHERE id = ?', [session.id]);
    adminName = user[0]?.full_name || session.username;
  } else {
    const admins = await dbQuery<{ full_name: string }[]>('SELECT full_name FROM admin_users WHERE id = ?', [session.id]);
    adminName = admins[0]?.full_name || session.username;
  }

  return (
    <div className="admin-layout" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      <AdminSidebar adminName={adminName} permissions={permissions} />
      <AdminBarcodeListener />
      <AdminKeyboardShortcuts />
      <main className="admin-content" style={{ flex: 1, width: '100%', maxWidth: '100%', minWidth: 0, overflowX: 'hidden' }}>
        {children}
      </main>
    </div>
  );
}
