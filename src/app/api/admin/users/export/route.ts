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
  const showInactive = searchParams.get('showInactive') === 'true';

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (!showInactive) {
      conditions.push(`u.is_active = 1`);
    }
    if (search) {
      conditions.push(`(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR u.id_document LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const users = await dbQuery<any[]>(`
      SELECT
        u.id,
        u.full_name,
        u.email,
        u.phone,
        u.id_document,
        u.address,
        CASE WHEN u.is_active = 1 THEN 'Activo' ELSE 'Inactivo' END AS estado,
        u.created_at,
        COUNT(o.id) AS total_orders,
        COALESCE(SUM(o.total), 0) AS total_spent,
        uc.credit_limit,
        uc.credit_used,
        uc.loyalty_points,
        uc.credit_status
      FROM users u
      LEFT JOIN orders o ON o.user_id = u.id AND o.status != 'cancelled'
      LEFT JOIN user_credits uc ON uc.user_id = u.id
      ${where}
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT 5000
    `, params);

    const headers = [
      'ID','Nombre Completo','Correo','Teléfono','Cédula','Dirección','Estado',
      'Registrado','Total Pedidos','Total Gastado','Límite Crédito',
      'Crédito Usado','Puntos Lealtad','Estado Crédito',
    ];

    const rows = [
      toRow(headers),
      ...users.map(u => toRow([
        u.id, u.full_name, u.email, u.phone || '', u.id_document || '',
        u.address || '', u.estado,
        new Date(u.created_at).toLocaleString('es-VE'),
        u.total_orders, Number(u.total_spent).toFixed(2),
        u.credit_limit != null ? Number(u.credit_limit).toFixed(2) : '',
        u.credit_used != null ? Number(u.credit_used).toFixed(2) : '',
        u.loyalty_points ?? '', u.credit_status || '',
      ])),
    ];

    const csv = '\uFEFF' + rows.join('\r\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="usuarios_${new Date().toISOString().slice(0,10)}.csv"`,
      },
    });
  } catch (err: any) {
    console.error('Users CSV export error:', err);
    return new Response('Error al exportar', { status: 500 });
  }
}
