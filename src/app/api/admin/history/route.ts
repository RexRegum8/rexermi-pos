export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tab = searchParams.get('tab') || 'sales';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '15', 10);
  const search = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || '';
  const typeFilter = searchParams.get('type') || '';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  
  const offset = (page - 1) * limit;

  try {
    // 1. Get global stats first
    const statsRows = await dbQuery<{ total_revenue: number; total_orders: number; cancelled_orders: number }[]>(
      `SELECT
        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END), 0) AS total_revenue,
        COUNT(*) AS total_orders,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_orders
      FROM orders`
    );
    const stats = statsRows[0] ?? { total_revenue: 0, total_orders: 0, cancelled_orders: 0 };

    const movStatsRows = await dbQuery<{ total_movements: number }[]>(
      `SELECT COUNT(*) AS total_movements FROM inventory_movements`
    );
    const movStats = movStatsRows[0] ?? { total_movements: 0 };

    const combinedStats = { ...stats, ...movStats };

    if (tab === 'sales') {
      let conditions: string[] = [];
      let params: any[] = [];

      if (statusFilter) {
        conditions.push("o.status = ?");
        params.push(statusFilter);
      }

      if (search) {
        conditions.push("(o.order_number LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR u.id_document LIKE ? OR oi.product_name LIKE ?)");
        const term = `%${search}%`;
        params.push(term, term, term, term, term);
      }

      if (dateFrom) {
        conditions.push("DATE(o.created_at) >= ?");
        params.push(dateFrom);
      }

      if (dateTo) {
        conditions.push("DATE(o.created_at) <= ?");
        params.push(dateTo);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get count of filtered orders
      const countRes = await dbQuery<any[]>(
        `SELECT COUNT(DISTINCT o.id) as total FROM orders o
         LEFT JOIN users u ON o.user_id = u.id
         LEFT JOIN order_items oi ON o.id = oi.order_id
         ${whereClause}`,
        params
      );
      const totalItems = countRes[0]?.total || 0;

      // Get paginated orders
      const orders = await dbQuery<any[]>(
        `SELECT 
          o.id,
          o.order_number,
          o.status,
          o.total,
          o.subtotal,
          o.payment_method,
          o.payment_ref,
          o.created_at,
          u.full_name AS customer_name,
          u.email AS customer_email,
          u.id_document AS customer_cedula,
          (
            SELECT GROUP_CONCAT(order_items.product_name || ' x' || order_items.quantity, ', ')
            FROM order_items
            WHERE order_items.order_id = o.id
          ) AS items_summary
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        ${whereClause}
        GROUP BY o.id
        ORDER BY o.created_at DESC
        LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      return NextResponse.json({
        orders,
        stats: combinedStats,
        totalItems
      });
    }

    if (tab === 'movements') {
      let conditions: string[] = [];
      let params: any[] = [];

      if (typeFilter) {
        conditions.push("im.movement_type = ?");
        params.push(typeFilter);
      }

      if (search) {
        conditions.push("(p.name LIKE ? OR im.reference_id LIKE ? OR im.notes LIKE ?)");
        const term = `%${search}%`;
        params.push(term, term, term);
      }

      if (dateFrom) {
        conditions.push("DATE(im.created_at) >= ?");
        params.push(dateFrom);
      }

      if (dateTo) {
        conditions.push("DATE(im.created_at) <= ?");
        params.push(dateTo);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get count of filtered movements
      const countRes = await dbQuery<any[]>(
        `SELECT COUNT(*) as total FROM inventory_movements im
         LEFT JOIN products p ON im.product_id = p.id
         ${whereClause}`,
        params
      );
      const totalItems = countRes[0]?.total || 0;

      const movements = await dbQuery<any[]>(
        `SELECT 
          im.id,
          im.movement_type,
          im.quantity_change,
          im.previous_stock,
          im.new_stock,
          im.reference_id,
          im.notes,
          im.created_at,
          p.name AS product_name,
          p.stock AS current_stock
        FROM inventory_movements im
        LEFT JOIN products p ON im.product_id = p.id
        ${whereClause}
        ORDER BY im.created_at DESC
        LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      return NextResponse.json({
        movements,
        stats: combinedStats,
        totalItems
      });
    }

    return NextResponse.json({ error: 'Tab inválida.' }, { status: 400 });
  } catch (error) {
    console.error('History API error:', error);
    return NextResponse.json({ error: 'Error al obtener historial.' }, { status: 500 });
  }
}
