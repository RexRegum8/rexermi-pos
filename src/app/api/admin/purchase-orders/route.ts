import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, dbBatch } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  try {
    let query = `
      SELECT po.*, s.name as supplier_name 
      FROM purchase_orders po 
      JOIN suppliers s ON po.supplier_id = s.id
    `;
    const params: any[] = [];

    if (status && ['pending', 'received', 'cancelled'].includes(status)) {
      query += ' WHERE po.status = ?';
      params.push(status);
    }

    query += ' ORDER BY po.created_at DESC';

    const purchaseOrders = await dbQuery<any[]>(query, params);
    return NextResponse.json({ success: true, purchaseOrders });
  } catch (error: any) {
    console.error('GET Purchase Orders Error:', error);
    return NextResponse.json({ error: 'Error al obtener órdenes de compra.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const body = (await req.json()) as any;
    const { supplier_id, notes, items } = body;

    const supplierId = parseInt(supplier_id, 10);
    if (isNaN(supplierId)) {
      return NextResponse.json({ error: 'Proveedor inválido.' }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Debe agregar al menos un producto a la compra.' }, { status: 400 });
    }

    // Verify supplier exists
    const supplierExists = await dbQuery<{ id: number }[]>('SELECT id FROM suppliers WHERE id = ?', [supplierId]);
    if (!supplierExists.length) {
      return NextResponse.json({ error: 'El proveedor seleccionado no existe.' }, { status: 404 });
    }

    let totalCost = 0;
    const poToken = `PO_TOKEN_${Date.now()}_${Math.random().toString(36).slice(-4)}`;
    const batchQueries: { sql: string; params?: any[] }[] = [];

    // 1. Create the purchase order header with temporary token in notes
    batchQueries.push({
      sql: `
        INSERT INTO purchase_orders (supplier_id, status, total_cost, notes, created_at, updated_at) 
        VALUES (?, 'pending', 0.0, ?, datetime('now'), datetime('now'))
      `,
      params: [supplierId, poToken]
    });

    // 2. Process items
    for (const item of items) {
      let pId = item.product_id ? parseInt(item.product_id, 10) : null;
      const name = item.product_name || item.name;
      const qty = parseInt(item.quantity, 10);
      const cost = parseFloat(item.cost_price);

      if (!name || name.trim() === '') {
        return NextResponse.json({ error: 'El nombre del producto es obligatorio.' }, { status: 400 });
      }
      if (isNaN(qty) || qty <= 0) {
        return NextResponse.json({ error: `La cantidad para ${name} debe ser mayor a 0.` }, { status: 400 });
      }
      if (isNaN(cost) || cost < 0) {
        return NextResponse.json({ error: `El costo de compra para ${name} es inválido.` }, { status: 400 });
      }

      // If product_id is null, pre-register the product in database (inactive, stock 0)
      if (!pId) {
        const retail = item.retail_price ? parseFloat(item.retail_price) : cost * 1.5;
        const catId = item.category_id ? parseInt(item.category_id, 10) : null;

        // Generate simple unique slug
        const baseSlug = name.toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        const slug = `${baseSlug}-${Math.random().toString(36).slice(-4)}`;

        batchQueries.push({
          sql: `
            INSERT INTO products (name, slug, price, stock, is_active, type, category_id, supplier_id, created_at, updated_at) 
            VALUES (?, ?, ?, 0, 0, 'product', ?, ?, datetime('now'), datetime('now'))
          `,
          params: [name.trim(), slug, retail, catId, supplierId]
        });

        // Insert purchase order item details using slug to find the newly inserted product ID
        batchQueries.push({
          sql: `
            INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, cost_price, quantity) 
            VALUES ((SELECT id FROM purchase_orders WHERE notes = ?), (SELECT id FROM products WHERE slug = ?), ?, ?, ?)
          `,
          params: [poToken, slug, name.trim(), cost, qty]
        });
      } else {
        // Insert purchase order item details
        batchQueries.push({
          sql: `
            INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, cost_price, quantity) 
            VALUES ((SELECT id FROM purchase_orders WHERE notes = ?), ?, ?, ?, ?)
          `,
          params: [poToken, pId, name.trim(), cost, qty]
        });
      }

      totalCost += cost * qty;
    }

    // 3. Update the total cost and restore notes on the purchase order header
    batchQueries.push({
      sql: "UPDATE purchase_orders SET total_cost = ?, notes = ?, updated_at = datetime('now') WHERE notes = ?",
      params: [totalCost, notes || '', poToken]
    });

    const results = await dbBatch(batchQueries);
    
    // Resolve order ID of the inserted purchase order
    const poResult = await dbQuery<{ id: number }[]>('SELECT id FROM purchase_orders WHERE notes = ? AND supplier_id = ? ORDER BY id DESC LIMIT 1', [notes || '', supplierId]);
    const newOrderId = poResult.length ? poResult[0].id : 0;

    return NextResponse.json({ 
      success: true, 
      message: 'Compra registrada correctamente en estado Pendiente.', 
      orderId: newOrderId 
    });

  } catch (error: any) {
    console.error('POST Purchase Order Error:', error);
    return NextResponse.json({ error: error.message || 'Error al registrar la orden de compra.' }, { status: 500 });
  }
}
