export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, dbBatch } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';
import { sendOrderStatusEmail } from '@/lib/mailer';

const VALID_STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const { id } = await params;
  const { status, admin_notes } = (await req.json()) as any;

  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 });
  }

  // Get current status to see if we are transitioning to/from "cancelled"
  const currentOrder = await dbQuery<{ status: string }[]>('SELECT status FROM orders WHERE id = ?', [id]);
  if (!currentOrder.length) {
    return NextResponse.json({ error: 'Pedido no encontrado.' }, { status: 404 });
  }
  const oldStatus = currentOrder[0].status;

  const updates: string[] = [];
  const vals: any[] = [];
  if (status) { updates.push('status = ?'); vals.push(status); }
  if (admin_notes !== undefined) { updates.push('admin_notes = ?'); vals.push(admin_notes); }

  if (!updates.length) return NextResponse.json({ error: 'Nada que actualizar.' }, { status: 400 });

  // 1. Validate delivered cancellation
  if (status === 'cancelled' && oldStatus === 'delivered') {
    return NextResponse.json({ error: 'No se puede cancelar un pedido que ya ha sido entregado.' }, { status: 400 });
  }

  try {
    const batchQueries: { sql: string; params?: any[] }[] = [];

    // Fetch order items if status changed
    let orderItems: { product_id: number; quantity: number }[] = [];
    const productDetailsMap: Record<number, { stock: number; name: string; type: string }> = {};

    if (status && oldStatus !== status) {
      orderItems = await dbQuery<{ product_id: number; quantity: number }[]>(
        'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
        [id]
      );

      for (const item of orderItems) {
        const prods = await dbQuery<{ stock: number; name: string; type: string }[]>(
          'SELECT stock, name, type FROM products WHERE id = ?',
          [item.product_id]
        );
        if (prods.length) {
          productDetailsMap[item.product_id] = prods[0];
        }
      }

      // Pre-validate stock if un-cancelling (prevent negative stock)
      if (oldStatus === 'cancelled' && status !== 'cancelled') {
        for (const item of orderItems) {
          const prod = productDetailsMap[item.product_id];
          if (prod && prod.type === 'product' && prod.stock < item.quantity) {
            return NextResponse.json({
              error: `Stock insuficiente para el producto "${prod.name}" para reactivar el pedido (Requerido: ${item.quantity}, Disponible: ${prod.stock}).`
            }, { status: 400 });
          }
        }
      }
    }

    // 2. Perform order updates query
    batchQueries.push({
      sql: `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`,
      params: [...vals, id]
    });

    // 3. Process stock updates if status changed
    if (status && oldStatus !== status) {
      for (const item of orderItems) {
        const prod = productDetailsMap[item.product_id];
        if (prod && prod.type === 'product') {
          const prevStock = prod.stock;
          let newStock = prevStock;
          let movementType = '';
          let qtyChange = 0;

          // If we are cancelling the order, restore stock
          if (status === 'cancelled' && oldStatus !== 'cancelled') {
            newStock = prevStock + item.quantity;
            movementType = 'cancellation';
            qtyChange = item.quantity;
          } 
          // If we are un-cancelling the order, deduct stock again
          else if (oldStatus === 'cancelled' && status !== 'cancelled') {
            newStock = prevStock - item.quantity;
            movementType = 'uncancellation';
            qtyChange = -item.quantity;
          }

          if (movementType) {
            batchQueries.push({
              sql: 'UPDATE products SET stock = ? WHERE id = ?',
              params: [newStock, item.product_id]
            });

            batchQueries.push({
              sql: `
                INSERT INTO inventory_movements (product_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `,
              params: [
                item.product_id,
                movementType,
                qtyChange,
                prevStock,
                newStock,
                `Order-${id}`,
                `Cambio de estado a ${status} por Admin ${admin.username}`
              ]
            });
          }
        }
      }
    }

    await dbBatch(batchQueries);

    // Send order status update email
    if (status && status !== oldStatus) {
      try {
        const orderDetails = await dbQuery<any[]>(`
          SELECT o.order_number, u.email, u.full_name
          FROM orders o
          LEFT JOIN users u ON o.user_id = u.id
          WHERE o.id = ?
        `, [id]);
        
        if (orderDetails.length && orderDetails[0].email) {
          const { order_number, email, full_name } = orderDetails[0];
          sendOrderStatusEmail(email, {
            orderNumber: order_number,
            customerName: full_name || 'Cliente',
            status: status
          }).catch(e => console.error('Error sending order status email:', e));
        }
      } catch (emailErr) {
        console.error('Failed to prepare status email:', emailErr);
      }
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al actualizar el pedido.' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
