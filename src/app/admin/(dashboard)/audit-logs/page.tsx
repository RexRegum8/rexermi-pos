import { dbQuery } from '@/lib/db';
import AuditLogsTable from './AuditLogsTable';
import { getAdminPermissions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Registro de Auditoría — Admin Rexermi' };
export const dynamic = 'force-dynamic';

interface AuditLog {
  id: number;
  admin_id: number | null;
  admin_email: string;
  action: string;
  details: string;
  created_at: string;
}

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const permissions = await getAdminPermissions();
  if (!permissions || !permissions.manage_users) {
    redirect('/admin');
  }

  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.page || '1', 10);
  const search = resolvedParams.search || '';

  const limit = 25;
  const offset = (page - 1) * limit;

  let conditions = [];
  let params: any[] = [];

  if (search) {
    conditions.push('(admin_email LIKE ? OR action LIKE ? OR details LIKE ?)');
    const pattern = `%${search}%`;
    params.push(pattern, pattern, pattern);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await dbQuery<{ total: number }[]>(
    `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`,
    params
  );
  const totalItems = countResult[0]?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));

  // Get logs
  const logs = await dbQuery<AuditLog[]>(
    `SELECT id, admin_id, admin_email, action, details, created_at
     FROM audit_logs
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return (
    <AuditLogsTable
      initialLogs={logs}
      totalPages={totalPages}
      currentPage={page}
      totalItems={totalItems}
    />
  );
}
