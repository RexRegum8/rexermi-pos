import React from 'react';
import { dbQuery } from '@/lib/db';
import OrdersTable from './OrdersTable';

export const metadata = { title: 'Pedidos — Admin Rexermi' };
export const dynamic = 'force-dynamic';

interface Order {
  id: number; order_number: string; status: string; total: number;
  payment_method: string; payment_proof: string | null;
  created_at: string; user_name: string; user_email: string; item_count: number;
  items_json?: string;
  shipping_address?: string | null;
  shipping_city?: string | null;
  customer_message?: string | null;
  admin_notes?: string | null;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string; showCompleted?: string; dateFrom?: string; dateTo?: string; sortBy?: string; sortOrder?: string }>;
}) {
  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.page || '1', 10);
  const search = resolvedParams.search || '';
  const status = resolvedParams.status || '';
  const showCompleted = resolvedParams.showCompleted === 'true';
  const dateFrom = resolvedParams.dateFrom || '';
  const dateTo = resolvedParams.dateTo || '';
  const sortBy = resolvedParams.sortBy || 'date';
  const sortOrder = resolvedParams.sortOrder === 'asc' ? 'ASC' : 'DESC';

  const allowedSortFields: Record<string, string> = {
    order: 'o.order_number',
    total: 'o.total',
    date: 'o.created_at',
    status: 'o.status',
  };
  const sortField = allowedSortFields[sortBy] || 'o.created_at';

  const limit = 20;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];

  if (!showCompleted) {
    conditions.push("o.status NOT IN ('delivered', 'cancelled')");
  }
  if (status) {
    conditions.push('o.status = ?');
    params.push(status);
  }
  if (search) {
    conditions.push('(o.order_number LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR o.payment_method LIKE ? OR o.status LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s, s, s);
  }
  if (dateFrom) {
    conditions.push('DATE(o.created_at) >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('DATE(o.created_at) <= ?');
    params.push(dateTo);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await dbQuery<{ total: number }[]>(`
    SELECT COUNT(DISTINCT o.id) AS total
    FROM orders o JOIN users u ON u.id = o.user_id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    ${whereClause}
  `, params);
  const totalItems = countResult[0]?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));

  const orders = await dbQuery<Order[]>(`
    SELECT o.*, u.full_name AS user_name, u.email AS user_email,
           COUNT(oi.id) AS item_count,
           (
             SELECT json_group_array(json_object('id', order_items.id, 'name', products.name, 'quantity', order_items.quantity, 'price', order_items.price))
             FROM order_items JOIN products ON products.id = order_items.product_id
             WHERE order_items.order_id = o.id
           ) AS items_json
    FROM orders o JOIN users u ON u.id = o.user_id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    ${whereClause}
    GROUP BY o.id ORDER BY ${sortField} ${sortOrder}
    LIMIT ? OFFSET ?
  `, [...params, limit, offset]);

  return (
    <>
      <div className="admin-topbar">
        <h1>📦 Gestión de Pedidos</h1>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{totalItems} pedidos en total</span>
      </div>
      <OrdersTable
        initialOrders={orders}
        totalPages={totalPages}
        currentPage={page}
        totalItems={totalItems}
      />
    </>
  );
}
