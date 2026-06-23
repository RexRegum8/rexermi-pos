export const runtime = 'edge';
import { NextRequest } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toRow(cols: unknown[]): string {
  return cols.map(escapeCsv).join(',');
}

export async function GET(req: NextRequest) {
  const session = await verifyAdminToken(req);
  if (!session) return new Response('No autorizado', { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const showCompleted = searchParams.get('showCompleted') === 'true';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (!showCompleted) {
      conditions.push(`o.status NOT IN ('delivered','cancelled')`);
    }
    if (status) {
      conditions.push('o.status = ?');
      params.push(status);
    }
    if (search) {
      conditions.push(`(o.order_number LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (dateFrom) {
      conditions.push(`DATE(o.created_at) >= ?`);
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push(`DATE(o.created_at) <= ?`);
      params.push(dateTo);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const orders = await dbQuery<any[]>(`
      SELECT
        o.id,
        o.order_number,
        o.status,
        o.total,
        o.payment_method,
        o.payment_ref,
        o.created_at,
        u.full_name   AS customer_name,
        u.email       AS customer_email,
        u.id_document AS customer_cedula,
        (SELECT GROUP_CONCAT(p.name || ' x' || oi.quantity, ' | ')
         FROM order_items oi JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = o.id) AS items_summary
      FROM orders o
      LEFT JOIN users u ON u.id = o.user_id
      ${where}
      ORDER BY o.created_at DESC
      LIMIT 5000
    `, params);

    const headers = [
      'ID','Número Orden','Estado','Total','Método Pago','Referencia',
      'Fecha','Cliente','Correo','Cédula','Productos',
    ];

    const rows = [
      toRow(headers),
      ...orders.map(o => toRow([
        o.id, o.order_number, o.status, Number(o.total).toFixed(2),
        o.payment_method, o.payment_ref || '',
        new Date(o.created_at).toLocaleString('es-VE'),
        o.customer_name || '', o.customer_email || '', o.customer_cedula || '',
        o.items_summary || '',
      ])),
    ];

    const csv = '\uFEFF' + rows.join('\r\n'); // BOM for Excel UTF-8 compatibility

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="pedidos_${new Date().toISOString().slice(0,10)}.csv"`,
      },
    });
  } catch (err: any) {
    console.error('Orders CSV export error:', err);
    return new Response('Error al exportar', { status: 500 });
  }
}
