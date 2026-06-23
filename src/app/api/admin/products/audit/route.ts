export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

interface AuditItem {
  id: number;
  currentStock: number;
  countedStock: number;
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const { items } = await req.json() as { items: AuditItem[] };
    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Listado de productos inválido.' }, { status: 400 });
    }

    // Process adjustments
    for (const item of items) {
      const { id, currentStock, countedStock } = item;
      const parsedId = parseInt(id as any, 10);
      const parsedCurrent = parseInt(currentStock as any, 10);
      const parsedCounted = parseInt(countedStock as any, 10);

      if (isNaN(parsedId) || isNaN(parsedCurrent) || isNaN(parsedCounted) || parsedCounted < 0) {
        continue; // skip invalid records
      }

      // Only perform update and movement if there's an actual discrepancy
      if (parsedCurrent !== parsedCounted) {
        // Update database stock
        await dbQuery('UPDATE products SET stock = ? WHERE id = ?', [parsedCounted, parsedId]);

        // Log inventory movement
        await dbQuery(
          'INSERT INTO inventory_movements (product_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            parsedId,
            'manual_adjustment',
            parsedCounted - parsedCurrent,
            parsedCurrent,
            parsedCounted,
            `Audit-${admin.id}`,
            `Ajuste por Toma Física de Inventario - Admin ${admin.username}`
          ]
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Submit inventory audit error:', error);
    return NextResponse.json({ error: 'Error al procesar la auditoría de inventario.' }, { status: 500 });
  }
}
