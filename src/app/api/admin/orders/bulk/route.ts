import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

const VALID_STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];

export async function PUT(req: NextRequest) {
  const session = await verifyAdminToken(req);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const { orderIds, status } = (await req.json()) as any;

    if (!Array.isArray(orderIds) || orderIds.length === 0)
      return NextResponse.json({ error: 'Se requieren IDs de pedidos.' }, { status: 400 });
    if (!VALID_STATUSES.includes(status))
      return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 });
    if (orderIds.length > 100)
      return NextResponse.json({ error: 'Máximo 100 pedidos por operación.' }, { status: 400 });

    const placeholders = orderIds.map(() => '?').join(',');
    const params = [status, ...orderIds];

    await dbQuery(
      `UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
      params
    );

    return NextResponse.json({
      success: true,
      message: `${orderIds.length} pedido(s) actualizados a "${status}".`,
      updated: orderIds.length,
    });
  } catch (err: any) {
    console.error('Bulk order update error:', err);
    return NextResponse.json({ error: 'Error al actualizar pedidos.' }, { status: 500 });
  }
}
