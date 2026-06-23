export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, dbBatch } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const { id } = await context.params;
    const orderId = parseInt(id, 10);

    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'ID de compra inválido.' }, { status: 400 });
    }

    const orders = await dbQuery<any[]>(`
      SELECT po.*, s.name as supplier_name, s.email as supplier_email, s.phone as supplier_phone 
      FROM purchase_orders po 
      JOIN suppliers s ON po.supplier_id = s.id 
      WHERE po.id = ?
    `, [orderId]);

    if (!orders.length) {
      return NextResponse.json({ error: 'La orden de compra no existe.' }, { status: 404 });
    }
    const order = orders[0];

    const items = await dbQuery<any[]>(`
      SELECT poi.*, p.slug, p.stock as current_stock, p.price as retail_price, p.barcode
      FROM purchase_order_items poi
      LEFT JOIN products p ON poi.product_id = p.id
      WHERE poi.purchase_order_id = ?
    `, [orderId]);

    return NextResponse.json({ success: true, order, items });
  } catch (error: any) {
    console.error('GET Purchase Order Detail Error:', error);
    return NextResponse.json({ error: 'Error al obtener detalle de la compra.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const { id } = await context.params;
    const orderId = parseInt(id, 10);
    const { status } = (await req.json()) as any;

    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'ID de compra inválido.' }, { status: 400 });
    }

    if (!status || !['received', 'cancelled'].includes(status)) {
      return NextResponse.json({ error: 'Estado de destino inválido.' }, { status: 400 });
    }

    // Fetch the order in its current state
    const orders = await dbQuery<any[]>('SELECT * FROM purchase_orders WHERE id = ?', [orderId]);
    if (!orders.length) {
      return NextResponse.json({ error: 'La compra no existe.' }, { status: 404 });
    }
    const order = orders[0];

    if (order.status !== 'pending') {
      return NextResponse.json({ error: 'Solo se pueden modificar compras en estado Pendiente.' }, { status: 400 });
    }

    const batchQueries: { sql: string; params?: any[] }[] = [];

    if (status === 'received') {
      // Fetch all items
      const items = await dbQuery<any[]>('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?', [orderId]);

      for (const item of items) {
        if (!item.product_id) continue;

        // Fetch current product details to track stock change
        const prods = await dbQuery<any[]>('SELECT stock, name FROM products WHERE id = ?', [item.product_id]);
        if (prods.length) {
          const prod = prods[0];
          const prevStock = prod.stock || 0;
          const newStock = prevStock + item.quantity;

          // 1. Update product stock, set active, set supplier_id
          batchQueries.push({
            sql: `
              UPDATE products 
              SET stock = ?, is_active = 1, supplier_id = ?, updated_at = datetime('now') 
              WHERE id = ?
            `,
            params: [newStock, order.supplier_id, item.product_id]
          });

          // 2. Log in inventory_movements
          batchQueries.push({
            sql: `
              INSERT INTO inventory_movements (product_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, notes, created_at)
              VALUES (?, 'purchase', ?, ?, ?, ?, ?, datetime('now'))
            `,
            params: [
              item.product_id, 
              item.quantity, 
              prevStock, 
              newStock, 
              `purchase_order_${orderId}`,
              `Compra recibida de proveedor (ID compra: ${orderId})`
            ]
          });
        }
      }

      // Update purchase order header to received
      batchQueries.push({
        sql: `
          UPDATE purchase_orders 
          SET status = 'received', received_at = datetime('now'), updated_at = datetime('now') 
          WHERE id = ?
        `,
        params: [orderId]
      });

    } else if (status === 'cancelled') {
      // Update purchase order header to cancelled
      batchQueries.push({
        sql: `
          UPDATE purchase_orders 
          SET status = 'cancelled', updated_at = datetime('now') 
          WHERE id = ?
        `,
        params: [orderId]
      });
    }

    await dbBatch(batchQueries);

    return NextResponse.json({ 
      success: true, 
      message: status === 'received' 
        ? 'Mercancía recibida e incorporada al inventario correctamente.' 
        : 'Compra cancelada correctamente.' 
    });

  } catch (error: any) {
    console.error('PUT Purchase Order Detail Error:', error);
    return NextResponse.json({ error: error.message || 'Error al actualizar estado de la compra.' }, { status: 500 });
  }
}
