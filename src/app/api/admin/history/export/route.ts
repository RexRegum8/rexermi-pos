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
  const tab = searchParams.get('tab') || 'sales';
  const search = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || '';
  const typeFilter = searchParams.get('type') || '';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';

  try {
    let conditions: string[] = [];
    let params: unknown[] = [];

    if (tab === 'sales') {
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

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const orders = await dbQuery<any[]>(`
        SELECT 
          o.id,
          o.order_number,
          o.status,
          o.subtotal,
          o.total,
          o.payment_method,
          o.payment_ref,
          o.created_at,
          u.full_name AS customer_name,
          u.email AS customer_email,
          u.id_document AS customer_cedula,
          (
            SELECT GROUP_CONCAT(order_items.product_name || ' x' || order_items.quantity, ' | ')
            FROM order_items
            WHERE order_items.order_id = o.id
          ) AS items_summary
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        ${where}
        GROUP BY o.id
        ORDER BY o.created_at DESC
        LIMIT 5000
      `, params);

      const headers = [
        'ID', 'Número Orden', 'Estado', 'Subtotal', 'Total', 'Método Pago', 
        'Referencia', 'Fecha', 'Cliente', 'Correo', 'Cédula', 'Productos'
      ];

      const rows = [
        toRow(headers),
        ...orders.map(o => toRow([
          o.id, o.order_number, o.status, Number(o.subtotal).toFixed(2), Number(o.total).toFixed(2),
          o.payment_method, o.payment_ref || '',
          new Date(o.created_at).toLocaleString('es-VE'),
          o.customer_name || '', o.customer_email || '', o.customer_cedula || '',
          o.items_summary || ''
        ]))
      ];

      const csv = '\uFEFF' + rows.join('\r\n');
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="historial_ventas_${new Date().toISOString().slice(0,10)}.csv"`,
        },
      });
    } else if (tab === 'movements') {
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

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const movements = await dbQuery<any[]>(`
        SELECT 
          im.id,
          im.movement_type,
          im.quantity_change,
          im.previous_stock,
          im.new_stock,
          im.reference_id,
          im.notes,
          im.created_at,
          p.name AS product_name
        FROM inventory_movements im
        LEFT JOIN products p ON im.product_id = p.id
        ${where}
        ORDER BY im.created_at DESC
        LIMIT 5000
      `, params);

      const headers = [
        'ID', 'Producto', 'Operación', 'Cambio Stock', 'Stock Previo', 'Stock Nuevo', 'Referencia', 'Anotaciones', 'Fecha'
      ];

      const rows = [
        toRow(headers),
        ...movements.map(m => toRow([
          m.id, m.product_name || 'Desconocido', m.movement_type, m.quantity_change, m.previous_stock, m.new_stock,
          m.reference_id || '', m.notes || '', new Date(m.created_at).toLocaleString('es-VE')
        ]))
      ];

      const csv = '\uFEFF' + rows.join('\r\n');
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="historial_inventario_${new Date().toISOString().slice(0,10)}.csv"`,
        },
      });
    }

    return new Response('Pestaña inválida', { status: 400 });
  } catch (err: any) {
    console.error('History CSV export error:', err);
    return new Response('Error al exportar', { status: 500 });
  }
}
