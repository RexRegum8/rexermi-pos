export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';
import { logAdminAction } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const body = (await req.json()) as any;
    const { productIds, type, value, direction } = body as {
      productIds: number[];
      type: 'flat' | 'percentage';
      value: number;
      direction: 'increase' | 'decrease';
    };

    if (!Array.isArray(productIds) || productIds.length === 0 || !type || typeof value !== 'number' || value < 0 || !direction) {
      return NextResponse.json({ error: 'Datos de entrada inválidos.' }, { status: 400 });
    }

    const multiplier = direction === 'increase' ? 1 : -1;
    let updatedCount = 0;

    // We can run a transaction or a loop. Using a simple loop for safety
    for (const id of productIds) {
      const prods = await dbQuery<{ price: number; name: string }[]>(
        'SELECT price, name FROM products WHERE id = ?',
        [id]
      );
      if (prods.length === 0) continue;

      const oldPrice = prods[0].price;
      let newPrice = oldPrice;

      if (type === 'percentage') {
        newPrice = oldPrice * (1 + (multiplier * value) / 100);
      } else {
        newPrice = oldPrice + multiplier * value;
      }

      newPrice = Math.max(0, Math.round(newPrice * 100) / 100);

      await dbQuery(
        'UPDATE products SET price = ? WHERE id = ?',
        [newPrice, id]
      );
      updatedCount++;
    }

    await logAdminAction(
      admin,
      'Ajuste masivo de precios',
      `Ajuste del ${direction === 'increase' ? '+' : '-'}${value}${type === 'percentage' ? '%' : '$'} en ${updatedCount} productos.`
    );

    return NextResponse.json({ success: true, updatedCount });
  } catch (error) {
    console.error('Batch price update error:', error);
    return NextResponse.json({ error: 'Error al actualizar precios en lote.' }, { status: 500 });
  }
}
