export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const { id } = await params;

  try {
    const history = await dbQuery<any[]>(`
      SELECT poi.cost_price, poi.quantity, po.created_at, po.received_at, s.name AS supplier_name, po.id AS purchase_order_id
      FROM purchase_order_items poi
      JOIN purchase_orders po ON po.id = poi.purchase_order_id
      LEFT JOIN suppliers s ON s.id = po.supplier_id
      WHERE poi.product_id = ? AND po.status = 'received'
      ORDER BY po.received_at DESC
    `, [id]);

    return NextResponse.json({ success: true, history });
  } catch (error: any) {
    console.error('GET Cost History Error:', error);
    return NextResponse.json({ error: 'Error al obtener historial de costos.' }, { status: 500 });
  }
}
