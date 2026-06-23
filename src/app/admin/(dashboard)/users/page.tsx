import { dbQuery } from '@/lib/db';
import UsersTable from './UsersTable';
import { getAdminPermissions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Usuarios — Admin Rexermi' };
export const dynamic = 'force-dynamic';

interface User {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  id_document: string | null;
  role: string;
  is_active: number;
  created_at: string;
  order_count: number;
  permissions?: string | null;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; showInactive?: string; sortBy?: string; sortOrder?: string }>;
}) {
  const permissions = await getAdminPermissions();
  if (!permissions || !permissions.manage_users) {
    redirect('/admin');
  }

  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.page || '1', 10);
  const search = resolvedParams.search || '';
  const showInactive = resolvedParams.showInactive === 'true';
  const sortBy = resolvedParams.sortBy || 'date';
  const sortOrder = resolvedParams.sortOrder === 'asc' ? 'ASC' : 'DESC';

  const allowedSortFields: Record<string, string> = {
    name: 'u.full_name',
    email: 'u.email',
    doc: 'u.id_document',
    orders: 'order_count',
    date: 'u.created_at',
  };
  const sortField = allowedSortFields[sortBy] || 'u.created_at';

  const limit = 20;
  const offset = (page - 1) * limit;

  // Build query conditions
  let conditions = [];
  let params: any[] = [];

  if (!showInactive) {
    conditions.push("u.is_active = 1");
  }

  if (search) {
    conditions.push("(u.full_name LIKE ? OR u.email LIKE ? OR u.id_document LIKE ? OR u.phone LIKE ? OR u.city LIKE ?)");
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countQuery = `
    SELECT COUNT(u.id) AS total
    FROM users u
    ${whereClause}
  `;
  const countResult = await dbQuery<{ total: number }[]>(countQuery, params);
  const totalItems = countResult[0]?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));

  // Get paginated users
  const usersQuery = `
    SELECT u.*, COUNT(o.id) AS order_count
    FROM users u
    LEFT JOIN orders o ON o.user_id = u.id
    ${whereClause}
    GROUP BY u.id
    ORDER BY ${sortField} ${sortOrder}
    LIMIT ? OFFSET ?
  `;
  
  const queryParams = [...params, limit, offset];
  const users = await dbQuery<User[]>(usersQuery, queryParams);

  // Get duplicates for duplicate groups detection (done efficiently at DB level)
  const duplicatesQuery = `
    SELECT u.*, COUNT(o.id) AS order_count
    FROM users u
    LEFT JOIN orders o ON o.user_id = u.id
    WHERE u.id_document IN (
      SELECT id_document FROM users WHERE id_document IS NOT NULL AND id_document != '' GROUP BY id_document HAVING COUNT(*) > 1
    ) OR u.email IN (
      SELECT email FROM users WHERE email IS NOT NULL AND email != '' AND email NOT LIKE '%@pos.local' GROUP BY email HAVING COUNT(*) > 1
    ) OR u.phone IN (
      SELECT phone FROM users WHERE phone IS NOT NULL AND phone != '' AND phone != '—' GROUP BY phone HAVING COUNT(*) > 1
    )
    GROUP BY u.id
  `;
  const duplicates = await dbQuery<User[]>(duplicatesQuery);

  return (
    <UsersTable 
      initialUsers={users} 
      initialDuplicates={duplicates}
      totalPages={totalPages}
      currentPage={page}
      totalItems={totalItems}
    />
  );
}
