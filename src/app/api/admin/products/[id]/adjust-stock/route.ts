export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const { id } = await params;
  try {
    const { stock } = (await req.json()) as any;
    const newStock = parseInt(stock, 10);
    if (isNaN(newStock) || newStock < 0) {
      return NextResponse.json({ error: 'El stock debe ser un número entero mayor o igual a 0.' }, { status: 400 });
    }

    // Get current stock to log movement
    const currentProd = await dbQuery<{ stock: number; name: string }[]>('SELECT stock, name FROM products WHERE id = ?', [id]);
    if (!currentProd || currentProd.length === 0) {
      return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 404 });
    }
    const oldStock = currentProd[0].stock;
    const name = currentProd[0].name;

    // Update stock
    await dbQuery('UPDATE products SET stock = ? WHERE id = ?', [newStock, id]);

    // Insert inventory movement
    if (oldStock !== newStock) {
      await dbQuery(
        'INSERT INTO inventory_movements (product_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, 'manual_adjustment', newStock - oldStock, oldStock, newStock, `Admin-${admin.id}`, `Ajuste rápido por escaneo global - Admin ${admin.username}`]
      );
    }

    return NextResponse.json({ success: true, name, oldStock, newStock });
  } catch (error: any) {
    console.error('Quick stock adjustment error:', error);
    return NextResponse.json({ error: 'Error al actualizar el stock.' }, { status: 500 });
  }
}
