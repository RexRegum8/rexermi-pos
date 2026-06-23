import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const rawLimit = parseInt(searchParams.get('limit') || '10', 10);
  const limit = Math.min(Math.max(1, rawLimit), 100);
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';

  const offset = (page - 1) * limit;

  try {
    // 1. Construir filtros dinámicos
    let conditions: string[] = [];
    let params: any[] = [];

    if (status) {
      conditions.push('o.status = ?');
      params.push(status);
    }

    if (search) {
      conditions.push('(o.order_number LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR o.payment_method LIKE ?)');
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 2. Obtener el total de ítems filtrados (para cálculo de páginas)
    const countQuery = `
      SELECT COUNT(DISTINCT o.id) AS total
      FROM orders o
      JOIN users u ON u.id = o.user_id
      ${whereClause}
    `;
    const countResult = await dbQuery<{ total: number }[]>(countQuery, params);
    const totalItems = countResult[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    // 3. Obtener los registros de la página actual utilizando LIMIT y OFFSET (paginación nativa)
    const ordersQuery = `
      SELECT o.id, o.order_number, o.status, o.total, o.subtotal, o.payment_method, 
             o.payment_ref, o.created_at, u.full_name AS customer_name, u.email AS customer_email,
             (
               SELECT json_group_array(json_object('id', oi.product_id, 'name', oi.product_name, 'quantity', oi.quantity, 'price', oi.price))
               FROM order_items oi
               WHERE oi.order_id = o.id
             ) AS items_json
      FROM orders o
      JOIN users u ON u.id = o.user_id
      ${whereClause}
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const orders = await dbQuery<any[]>(ordersQuery, [...params, limit, offset]);

    return NextResponse.json({
      success: true,
      orders,
      totalItems,
      totalPages,
      currentPage: page,
      limit,
    });
  } catch (error) {
    console.error('Paginación API error en pedidos:', error);
    return NextResponse.json({ error: 'Error al obtener pedidos paginados.' }, { status: 500 });
  }
}
