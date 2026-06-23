import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, dbBatch } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const requests = await dbQuery<any[]>(`
      SELECT 
        cr.*, 
        u.full_name as customer_name,
        u.phone as customer_phone,
        o.order_number,
        o.total as order_total,
        uc.credit_limit,
        uc.credit_used,
        uc.loyalty_points
      FROM credit_requests cr
      JOIN users u ON cr.user_id = u.id
      JOIN orders o ON cr.order_id = o.id
      LEFT JOIN user_credits uc ON cr.user_id = uc.user_id
      ORDER BY cr.created_at DESC
    `);

    return NextResponse.json({ success: true, requests });
  } catch (error) {
    console.error('Failed to get credit requests:', error);
    return NextResponse.json({ error: 'Error al obtener peticiones de crédito.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const { id, status, adminNotes } = (await req.json()) as any;
    if (!id || !status || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 });
    }

    const requests = await dbQuery<any[]>('SELECT * FROM credit_requests WHERE id = ?', [id]);
    if (!requests.length) {
      return NextResponse.json({ error: 'Petición de crédito no encontrada.' }, { status: 404 });
    }
    const request = requests[0];

    if (request.status !== 'pending') {
      return NextResponse.json({ error: 'Esta petición ya ha sido resuelta.' }, { status: 400 });
    }

    const resolvedAt = new Date().toISOString();

    if (status === 'approved') {
      // Approve flow: Verify credit limit and update credit_used
      try {
        // Fetch current credit info
        const creditRows = await dbQuery<any[]>('SELECT * FROM user_credits WHERE user_id = ?', [request.user_id]);
        let credit = creditRows[0];
        
        if (!credit) {
          const initialPointsRow = await dbQuery<{ value: string }[]>("SELECT value FROM settings WHERE key = 'loyalty_initial_points'");
          const initialPoints = parseInt(initialPointsRow[0]?.value || '100');
          const multiplierRow = await dbQuery<{ value: string }[]>("SELECT value FROM settings WHERE key = 'loyalty_points_to_credit_multiplier'");
          const multiplier = parseFloat(multiplierRow[0]?.value || '2.0');
          const limit = initialPoints * multiplier;

          await dbQuery(`
            INSERT INTO user_credits (user_id, credit_limit, credit_used, loyalty_points, credit_status)
            VALUES (?, ?, 0.0, ?, 'active')
          `, [request.user_id, limit, initialPoints]);

          credit = { credit_limit: limit, credit_used: 0.0, credit_status: 'active' };
        }

        if (credit.credit_status !== 'active') {
          throw new Error(`El crédito del cliente está inactivo o suspendido (Estado: ${credit.credit_status}).`);
        }

        const available = credit.credit_limit - credit.credit_used;
        if (available < request.amount) {
          throw new Error(`Crédito insuficiente. Disponible: $${available.toFixed(2)}, Requerido: $${request.amount.toFixed(2)}`);
        }

        // Fetch order number
        const order = await dbQuery<any[]>('SELECT order_number FROM orders WHERE id = ?', [request.order_id]);
        const orderNum = order[0] ? order[0].order_number : `ORD-${request.order_id}`;

        // Execute batch updates
        await dbBatch([
          {
            sql: 'UPDATE user_credits SET credit_used = credit_used + ? WHERE user_id = ?',
            params: [request.amount, request.user_id]
          },
          {
            sql: `
              INSERT INTO credit_history (user_id, amount_change, movement_type, reference_id, notes)
              VALUES (?, ?, 'purchase', ?, ?)
            `,
            params: [request.user_id, request.amount, orderNum, `Aprobación de compra a crédito online. Orden ${orderNum}`]
          },
          {
            sql: "UPDATE orders SET status = 'pending', admin_notes = ? WHERE id = ?",
            params: [`Crédito aprobado por administrador. Notas: ${adminNotes || 'Ninguna'}`, request.order_id]
          },
          {
            sql: 'UPDATE credit_requests SET status = \'approved\', admin_notes = ?, resolved_at = ? WHERE id = ?',
            params: [adminNotes || '', resolvedAt, id]
          }
        ]);
      } catch (txError: any) {
        return NextResponse.json({ error: txError.message || 'Error en la transacción de aprobación.' }, { status: 400 });
      }
    } else {
      // Reject flow: Revert stock and update order status to 'cancelled'
      try {
        // 1. Fetch order items to restore stock
        const orderItems = await dbQuery<{ product_id: number; quantity: number }[]>('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [request.order_id]);
        const order = await dbQuery<any[]>('SELECT order_number FROM orders WHERE id = ?', [request.order_id]);
        const orderNum = order[0] ? order[0].order_number : `ORD-${request.order_id}`;

        const batchOps: { sql: string; params: any[] }[] = [];

        for (const item of orderItems) {
          const prods = await dbQuery<{ stock: number; type: string }[]>('SELECT stock, type FROM products WHERE id = ?', [item.product_id]);
          const prod = prods[0];
          if (prod && prod.type === 'product') {
            const prevStock = prod.stock;
            const newStock = prevStock + item.quantity;
            
            batchOps.push({
              sql: 'UPDATE products SET stock = stock + ? WHERE id = ?',
              params: [item.quantity, item.product_id]
            });
            batchOps.push({
              sql: `
                INSERT INTO inventory_movements 
                  (product_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, notes) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `,
              params: [
                item.product_id, 
                'pos_adjust_restore', 
                item.quantity, 
                prevStock, 
                newStock, 
                orderNum, 
                `Restauración por rechazo de petición de crédito online`
              ]
            });
          }
        }

        // Set order status to cancelled
        batchOps.push({
          sql: "UPDATE orders SET status = 'cancelled', admin_notes = ? WHERE id = ?",
          params: [`Petición de crédito rechazada. Notas: ${adminNotes || 'Ninguna'}`, request.order_id]
        });

        // Resolve request
        batchOps.push({
          sql: 'UPDATE credit_requests SET status = \'rejected\', admin_notes = ?, resolved_at = ? WHERE id = ?',
          params: [adminNotes || '', resolvedAt, id]
        });

        await dbBatch(batchOps);
      } catch (txError: any) {
        return NextResponse.json({ error: txError.message || 'Error en la transacción de rechazo.' }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to resolve credit request:', error);
    return NextResponse.json({ error: 'Error al procesar la resolución de crédito.' }, { status: 500 });
  }
}
