export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, dbBatch } from '@/lib/db';
import { getPOSSession } from '@/lib/auth';
import { sendOrderStatusEmail } from '@/lib/mailer';

export async function GET(req: NextRequest) {
  const session = await getPOSSession();
  if (!session || (session.role !== 'vendedor' && session.role !== 'admin' && session.role !== 'custom')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const completed = searchParams.get('completed') === 'true';

  try {
    if (completed) {
      // Get the active open closure for the user
      const activeClosures = await dbQuery<{ id: number }[]>("SELECT id FROM cash_closures WHERE user_id = ? AND status = 'open'", [session.id]);
      if (!activeClosures.length) {
        return NextResponse.json({ success: true, orders: [] });
      }
      const activeClosure = activeClosures[0];

      // Fetch last 10 completed orders for this shift
      const orders = await dbQuery<any[]>(`
        SELECT o.id, o.order_number, o.status, o.total, o.created_at, o.payment_method, 
               o.shipping_address, o.shipping_city, o.shipping_method, o.customer_message,
               o.payment_ref, o.payment_proof, o.subtotal, o.shipping_cost, o.user_id,
               u.full_name as customer_name, u.phone as customer_phone, u.email as customer_email,
               (
                 SELECT json_group_array(json_object('id', oi.product_id, 'name', oi.product_name, 'quantity', oi.quantity, 'price', oi.price))
                 FROM order_items oi
                 WHERE oi.order_id = o.id
               ) AS items_json
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.cash_closure_id = ? AND o.status = 'delivered'
        ORDER BY o.created_at DESC
        LIMIT 10
      `, [activeClosure.id]);

      return NextResponse.json({ success: true, orders });
    }

    // Only fetch pending orders for the store to fulfill
    const orders = await dbQuery<any[]>(`
      SELECT o.id, o.order_number, o.status, o.total, o.created_at, o.payment_method, 
             o.shipping_address, o.shipping_city, o.shipping_method, o.customer_message,
             o.payment_ref, o.payment_proof, o.subtotal, o.shipping_cost, o.user_id,
             u.full_name as customer_name, u.phone as customer_phone, u.email as customer_email,
             (
               SELECT json_group_array(json_object('id', oi.product_id, 'name', oi.product_name, 'quantity', oi.quantity, 'price', oi.price))
               FROM order_items oi
               WHERE oi.order_id = o.id
             ) AS items_json
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.status = 'pending'
      ORDER BY o.created_at ASC
    `);
    
    return NextResponse.json({ success: true, orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Error fetching orders' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getPOSSession();
  if (!session || (session.role !== 'vendedor' && session.role !== 'admin' && session.role !== 'custom')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { id, status } = (await req.json()) as any;

    if (!id || !status) {
      return NextResponse.json({ error: 'ID y estado son requeridos.' }, { status: 400 });
    }

    const VALID_STATUSES = ['delivered', 'cancelled'];
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Estado no admitido por este endpoint.' }, { status: 400 });
    }

    // Get current order status
    const currentOrder = await dbQuery<{ status: string }[]>('SELECT status FROM orders WHERE id = ?', [id]);
    if (!currentOrder.length) {
      return NextResponse.json({ error: 'Pedido no encontrado.' }, { status: 404 });
    }
    const oldStatus = currentOrder[0].status;

    if (oldStatus === status) {
      return NextResponse.json({ success: true, message: 'El pedido ya se encuentra en ese estado.' });
    }

    if (status === 'cancelled' && oldStatus !== 'cancelled') {
      const orderItems = await dbQuery<{ product_id: number; quantity: number }[]>(
        'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
        [id]
      );

      const productDetailsMap: Record<number, { stock: number; name: string; type: string }> = {};
      for (const item of orderItems) {
        if (!item.product_id) continue;
        const prods = await dbQuery<{ stock: number; name: string; type: string }[]>(
          'SELECT stock, name, type FROM products WHERE id = ?',
          [item.product_id]
        );
        if (prods.length) {
          productDetailsMap[item.product_id] = prods[0];
        }
      }

      const batchQueries: { sql: string; params?: any[] }[] = [];
      batchQueries.push({
        sql: 'UPDATE orders SET status = ? WHERE id = ?',
        params: [status, id]
      });

      for (const item of orderItems) {
        const prod = productDetailsMap[item.product_id];
        if (prod && prod.type === 'product') {
          const prevStock = prod.stock;
          const newStock = prevStock + item.quantity;

          batchQueries.push({
            sql: 'UPDATE products SET stock = ? WHERE id = ?',
            params: [newStock, item.product_id]
          });

          batchQueries.push({
            sql: `
              INSERT INTO inventory_movements (product_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, notes)
              VALUES (?, 'cancellation', ?, ?, ?, ?, ?)
            `,
            params: [
              item.product_id,
              item.quantity,
              prevStock,
              newStock,
              `Order-${id}`,
              `Pedido cancelado desde POS por vendedor ${session.fullName}`
            ]
          });
        }
      }

      await dbBatch(batchQueries);
    } else {
      await dbQuery('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    }

    // Send order status update email
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
        }).catch(e => console.error('Error sending order status email from POS:', e));
      }
    } catch (emailErr) {
      console.error('Failed to prepare POS status email:', emailErr);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('POS order update error:', error);
    return NextResponse.json({ error: error.message || 'Error al actualizar el pedido.' }, { status: 400 });
  }
}
