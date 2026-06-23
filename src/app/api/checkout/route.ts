export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import db, { dbQuery, dbBatch } from '@/lib/db';
import { verifyCustomerToken } from '@/lib/auth';
import { sendOrderConfirmationEmail } from '@/lib/mailer';
import { isValidImageOrPdfBuffer, generateOrderNumber } from '@/lib/helpers';
import { isStoreOpen } from '@/lib/settings';

interface CartItemPayload {
  id: number;
  name: string;
  price: number;
  quantity: number;
  type: 'product' | 'service';
  stock: number;
}

export async function POST(req: NextRequest) {
  // Verify user is logged in
  const user = await verifyCustomerToken(req);
  if (!user) {
    return NextResponse.json({ error: 'Debes iniciar sesión para realizar un pedido.' }, { status: 401 });
  }

  // Check store operations status (store_open and schedule)
  const settingsMap: Record<string, string> = {};
  try {
    const settingsRows = await dbQuery<{ key: string; value: string }[]>('SELECT `key`, \`value\` FROM settings');
    settingsRows.forEach(r => { settingsMap[r.key] = r.value || ''; });

    if (!isStoreOpen(settingsMap)) {
      return NextResponse.json({ error: 'La tienda se encuentra cerrada (fuera del horario de atención comercial o por mantenimiento).' }, { status: 403 });
    }
  } catch (err) {
    console.error('Error checking store operations status:', err);
  }

  try {
    const formData = await req.formData();

    const cartJson = formData.get('cart') as string;
    const paymentMethod = formData.get('payment_method') as string;
    const paymentRef = formData.get('payment_ref') as string | null;
    const customerMessage = formData.get('customer_message') as string | null;
    const shippingAddress = formData.get('shipping_address') as string | null;
    const shippingCity = formData.get('shipping_city') as string | null;
    const couponCode = formData.get('coupon_code') as string | null;
    const couponId = formData.get('coupon_id') ? parseInt(formData.get('coupon_id') as string) : null;
    const discountAmount = formData.get('discount_amount') ? parseFloat(formData.get('discount_amount') as string) : 0;
    const receiptFile = formData.get('payment_proof') as File | null;
    const shippingMethod = formData.get('shipping_method') as string;

    if (!cartJson || !paymentMethod || !shippingMethod) {
      return NextResponse.json({ error: 'Datos del pedido incompletos.' }, { status: 400 });
    }

    // Validate dynamic shipping method from DB
    const shippingMethods = await dbQuery<any[]>(
      'SELECT id, name, cost FROM shipping_methods WHERE id = ? AND is_active = 1',
      [shippingMethod]
    );
    if (!shippingMethods.length) {
      return NextResponse.json({ error: 'El método de envío seleccionado no es válido o no está activo.' }, { status: 400 });
    }
    const selectedShipping = shippingMethods[0];

    // Enforce shipping address/city unless Retiro en Tienda
    const isPickup = selectedShipping.name.toLowerCase().includes('retiro');
    if (!isPickup) {
      if (!shippingAddress || !shippingAddress.trim()) {
        return NextResponse.json({ error: 'La dirección de entrega es obligatoria para este método de envío.' }, { status: 400 });
      }
      if (!shippingCity || !shippingCity.trim()) {
        return NextResponse.json({ error: 'La ciudad de entrega es obligatoria para este método de envío.' }, { status: 400 });
      }
    }

    // Validate dynamic payment method from DB
    const paymentMethods = await dbQuery<any[]>(
      'SELECT id, name, requires_proof FROM payment_methods WHERE id = ? AND is_active = 1',
      [paymentMethod]
    );
    if (!paymentMethods.length) {
      return NextResponse.json({ error: 'El método de pago seleccionado no es válido o no está activo.' }, { status: 400 });
    }
    const selectedPM = paymentMethods[0];
    const requiresProof = selectedPM.requires_proof === 1;

    if (selectedPM.name === 'Crédito') {
      const { isCreditAvailable } = require('@/lib/settings');
      if (!isCreditAvailable(settingsMap)) {
        return NextResponse.json({ error: 'El sistema de crédito no está disponible en este momento (fuera de temporada u horario activo).' }, { status: 400 });
      }

      // Ensure user_credits row exists
      const initialPoints = parseInt(settingsMap['loyalty_initial_points'] || '100');
      const multiplier = parseFloat(settingsMap['loyalty_points_to_credit_multiplier'] || '2.0');
      const limit = initialPoints * multiplier;

      await dbQuery(`
        INSERT OR IGNORE INTO user_credits (user_id, credit_limit, credit_used, loyalty_points, credit_status)
        VALUES (?, ?, 0.0, ?, 'active')
      `, [user.id, limit, initialPoints]);

      const creditRows = await dbQuery<{ credit_limit: number; credit_used: number; credit_status: string }[]>(
        'SELECT credit_limit, credit_used, credit_status FROM user_credits WHERE user_id = ?',
        [user.id]
      );
      const credit = creditRows[0];
      if (credit.credit_status !== 'active') {
        return NextResponse.json({ error: 'Tu cuenta de crédito se encuentra suspendida o anulada. Por favor contacta al soporte.' }, { status: 400 });
      }
    } else if (requiresProof) {
      if (!paymentRef || !paymentRef.trim()) {
        return NextResponse.json({ error: `La referencia de pago es requerida para el método ${selectedPM.name}.` }, { status: 400 });
      }
      if (!receiptFile || receiptFile.size === 0) {
        return NextResponse.json({ error: `El comprobante de pago es requerido para el método ${selectedPM.name}.` }, { status: 400 });
      }
    }

    const cart: CartItemPayload[] = JSON.parse(cartJson);
    if (!cart.length) {
      return NextResponse.json({ error: 'El carrito está vacío.' }, { status: 400 });
    }

    let calculatedSubtotal = 0;
    const validatedCartItems = [];
    const runningStocks: Record<number, number> = {};
    const productDetailsMap: Record<number, any> = {};

    // Validate stock and verify prices for all items in the cart
    for (const item of cart) {
      const dbProducts = await dbQuery<{ id: number; name: string; price: number; stock: number; type: 'product' | 'service'; is_active: number; es_subproducto: number; id_producto_padre: number | null; unidades_por_padre: number | null; parent_stock: number | null; parent_name: string | null }[]>(
        `SELECT p.id, p.name, p.price, p.stock, p.type, p.is_active,
                p.es_subproducto, p.id_producto_padre, p.unidades_por_padre,
                parent.stock AS parent_stock, parent.name AS parent_name
         FROM products p
         LEFT JOIN products parent ON p.id_producto_padre = parent.id
         WHERE p.id = ?`,
        [item.id]
      );
      if (!dbProducts.length || dbProducts[0].is_active !== 1) {
        return NextResponse.json({ error: `El producto o servicio "${item.name || ('ID: ' + item.id)}" ya no está disponible.` }, { status: 400 });
      }
      const dbProd = dbProducts[0];
      productDetailsMap[dbProd.id] = dbProd;

      if (runningStocks[dbProd.id] === undefined) {
        runningStocks[dbProd.id] = dbProd.stock;
      }
      if (dbProd.id_producto_padre !== null && runningStocks[dbProd.id_producto_padre] === undefined) {
        runningStocks[dbProd.id_producto_padre] = dbProd.parent_stock !== null ? dbProd.parent_stock : 0;
      }
      
      if (dbProd.type === 'product') {
        const childStock = runningStocks[dbProd.id];
        let availableStock = childStock;
        if (dbProd.es_subproducto === 1 && dbProd.id_producto_padre !== null && dbProd.unidades_por_padre !== null && dbProd.unidades_por_padre > 0) {
          const parentStock = runningStocks[dbProd.id_producto_padre];
          availableStock = childStock + (parentStock * dbProd.unidades_por_padre);
        }

        if (availableStock < item.quantity) {
          if (dbProd.es_subproducto === 1 && dbProd.id_producto_padre !== null) {
            const parentStock = runningStocks[dbProd.id_producto_padre];
            return NextResponse.json(
              { error: `Stock insuficiente. Solo quedan ${childStock} unidades de "${dbProd.name}" y ${parentStock} cajas de "${dbProd.parent_name || 'producto padre'}" (Total disponible: ${availableStock} unidades).` },
              { status: 400 }
            );
          } else {
            return NextResponse.json(
              { error: `Solo quedan ${childStock} unidades de "${dbProd.name}".` },
              { status: 400 }
            );
          }
        }

        const reqQty = item.quantity;
        if (childStock >= reqQty) {
          runningStocks[dbProd.id] = childStock - reqQty;
        } else {
          const missingUnits = reqQty - childStock;
          const boxesToBreak = Math.ceil(missingUnits / dbProd.unidades_por_padre!);
          const parentStock = runningStocks[dbProd.id_producto_padre!];
          runningStocks[dbProd.id_producto_padre!] = parentStock - boxesToBreak;
          const addedUnits = boxesToBreak * dbProd.unidades_por_padre!;
          runningStocks[dbProd.id] = childStock + addedUnits - reqQty;
        }
      }
      calculatedSubtotal += dbProd.price * item.quantity;
      validatedCartItems.push({
        id: dbProd.id,
        name: dbProd.name,
        price: dbProd.price,
        quantity: item.quantity,
        type: dbProd.type,
        stock: dbProd.stock
      });
    }

    // Validate min_order setting
    try {
      const minOrderRows = await dbQuery<{ key: string; value: string }[]>('SELECT `key`, `value` FROM settings WHERE `key` = \'min_order\'');
      const minOrder = parseFloat(minOrderRows[0]?.value || '0');
      if (minOrder > 0 && calculatedSubtotal < minOrder) {
        return NextResponse.json({ error: `El pedido mínimo para comprar es de $${minOrder.toFixed(2)}. Tu subtotal actual es de $${calculatedSubtotal.toFixed(2)}.` }, { status: 400 });
      }
    } catch (err) {
      console.error('Error checking min_order setting:', err);
    }

    // Validate coupon and calculate discount amount server-side
    let finalDiscountAmount = 0;
    if (couponId || couponCode) {
      let querySql = 'SELECT * FROM coupons WHERE is_active = 1';
      let params = [];
      if (couponId) {
        querySql += ' AND id = ?';
        params.push(couponId);
      } else {
        querySql += ' AND code = ?';
        params.push(couponCode?.trim().toUpperCase());
      }
      
      const coupons = await dbQuery<any[]>(querySql, params);
      if (coupons.length > 0) {
        const coupon = coupons[0];
        const now = new Date();
        const expiresAt = coupon.expires_at ? new Date(coupon.expires_at) : null;
        const isExpired = expiresAt && expiresAt < now;
        const hasUsesLeft = coupon.uses_left === null || coupon.uses_left > 0;
        const meetsMinOrder = !coupon.min_order || calculatedSubtotal >= parseFloat(coupon.min_order);

        if (!isExpired && hasUsesLeft && meetsMinOrder) {
          if (coupon.discount_type === 'percent') {
            finalDiscountAmount = (calculatedSubtotal * parseFloat(coupon.discount_value)) / 100;
          } else if (coupon.discount_type === 'fixed') {
            finalDiscountAmount = parseFloat(coupon.discount_value);
          }
          finalDiscountAmount = Math.min(finalDiscountAmount, calculatedSubtotal);
        }
      }
    }

    const total = Math.max(0, calculatedSubtotal - finalDiscountAmount + selectedShipping.cost);

    if (selectedPM.name === 'Crédito') {
      const creditRows = await dbQuery<{ credit_limit: number; credit_used: number }[]>(
        'SELECT credit_limit, credit_used FROM user_credits WHERE user_id = ?',
        [user.id]
      );
      if (creditRows.length) {
        const credit = creditRows[0];
        const available = credit.credit_limit - credit.credit_used;
        if (available < total) {
          return NextResponse.json({ error: `Límite de crédito insuficiente. Disponible: $${available.toFixed(2)}, Total del pedido: $${total.toFixed(2)}` }, { status: 400 });
        }
      }
    }

    // Save payment proof file to private directory
    let proofFilename: string | null = null;
    if (receiptFile && receiptFile.size > 0) {
      const maxSize = 5 * 1024 * 1024; // 5 MB
      if (receiptFile.size > maxSize) {
        return NextResponse.json({ error: 'El comprobante no puede superar 5 MB.' }, { status: 400 });
      }
      const fileExt = receiptFile.name.includes('.') ? receiptFile.name.substring(receiptFile.name.lastIndexOf('.')) : '.jpg';
      const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
      if (!allowedExts.includes(fileExt.toLowerCase())) {
        return NextResponse.json({ error: 'Formato de comprobante no permitido. Usa JPG, PNG o PDF.' }, { status: 400 });
      }

      const timestamp = Date.now();
      proofFilename = `receipt_${user.id}_${timestamp}${fileExt}`;

      if (typeof EdgeRuntime !== 'string') {
        const requireFunc = typeof __webpack_require__ === "function" ? __non_webpack_require__ : require;
        const fsLib = requireFunc('fs');
        const pathLib = requireFunc('path');
        const receiptsDir = pathLib.join(process['cwd'](), 'private', 'receipts');
        if (!fsLib.existsSync(receiptsDir)) fsLib.mkdirSync(receiptsDir, { recursive: true });

        const buffer = Buffer.from(await receiptFile.arrayBuffer());
        if (!isValidImageOrPdfBuffer(buffer)) {
          return NextResponse.json({ error: 'Archivo de comprobante inválido o corrupto.' }, { status: 400 });
        }
        fsLib.writeFileSync(pathLib.join(receiptsDir, proofFilename), buffer);
      } else {
        console.log('Running on Cloudflare Edge: skipping physical receipt file write on disk.');
      }
    }

    // Generate unique order number
    const orderNumber = generateOrderNumber('REX');

    const creditMode = settingsMap['credit_mode'] || 'free';
    const initialOrderStatus = (selectedPM.name === 'Crédito' && creditMode === 'request') ? 'pending_credit' : 'pending';

    // Compile all database statements for the transaction batch
    const batchQueries: { sql: string; params?: any[] }[] = [];

    // 1. Insert order
    batchQueries.push({
      sql: `
        INSERT INTO orders 
          (order_number, user_id, status, subtotal, shipping_cost, total, payment_method, payment_ref, payment_proof, customer_message, shipping_address, shipping_city, shipping_method)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        orderNumber,
        user.id,
        initialOrderStatus,
        calculatedSubtotal.toFixed(2),
        selectedShipping.cost.toFixed(2),
        total.toFixed(2),
        selectedPM.name,
        paymentRef || null,
        proofFilename,
        customerMessage || null,
        shippingAddress || null,
        shippingCity || null,
        selectedShipping.name,
      ]
    });

    if (selectedPM.name === 'Crédito') {
      const parsedTotal = total;
      const uId = user.id;

      if (creditMode === 'free') {
        batchQueries.push({
          sql: 'UPDATE user_credits SET credit_used = credit_used + ? WHERE user_id = ?',
          params: [parsedTotal, uId]
        });

        const pointsPerDollar = parseFloat(settingsMap['loyalty_points_per_dollar'] || '0.1');
        const pointsEarned = Math.floor(parsedTotal * pointsPerDollar) || 1;
        const multiplier = parseFloat(settingsMap['loyalty_points_to_credit_multiplier'] || '2.0');

        batchQueries.push({
          sql: 'UPDATE user_credits SET loyalty_points = loyalty_points + ?, credit_limit = (loyalty_points + ?) * ? WHERE user_id = ?',
          params: [pointsEarned, pointsEarned, multiplier, uId]
        });

        batchQueries.push({
          sql: `
            INSERT INTO credit_history (user_id, amount_change, movement_type, reference_id, notes)
            VALUES (?, ?, 'purchase', ?, ?)
          `,
          params: [uId, parsedTotal, orderNumber, `Compra a crédito libre. Orden ${orderNumber}`]
        });

        batchQueries.push({
          sql: `
            INSERT INTO loyalty_history (user_id, points_change, reason, reference_id)
            VALUES (?, ?, 'Compra a crédito libre', ?)
          `,
          params: [uId, pointsEarned, orderNumber]
        });
      } else {
        batchQueries.push({
          sql: `
            INSERT INTO credit_requests (order_id, user_id, amount, status)
            VALUES ((SELECT id FROM orders WHERE order_number = ?), ?, ?, 'pending')
          `,
          params: [orderNumber, uId, parsedTotal]
        });
      }
    }

    // Reset batch running stocks using original database states
    const batchRunningStocks: Record<number, number> = {};
    for (const id in runningStocks) {
      const prod = productDetailsMap[Number(id)];
      if (prod) {
        batchRunningStocks[prod.id] = prod.stock;
      }
      for (const cid in productDetailsMap) {
        const cp = productDetailsMap[Number(cid)];
        if (cp.id_producto_padre === Number(id)) {
          batchRunningStocks[Number(id)] = cp.parent_stock !== null ? cp.parent_stock : 0;
        }
      }
    }

    for (const item of validatedCartItems) {
      batchQueries.push({
        sql: 'INSERT INTO order_items (order_id, product_id, product_name, price, quantity, subtotal) VALUES ((SELECT id FROM orders WHERE order_number = ?), ?, ?, ?, ?, ?)',
        params: [
          orderNumber,
          item.id,
          item.name,
          item.price.toFixed(2),
          item.quantity,
          (item.price * item.quantity).toFixed(2)
        ]
      });

      const prod = productDetailsMap[item.id];
      if (prod && prod.type === 'product') {
        const reqQty = item.quantity;
        const currentChildStock = batchRunningStocks[prod.id];

        if (currentChildStock >= reqQty) {
          const newStock = currentChildStock - reqQty;
          batchRunningStocks[prod.id] = newStock;
          
          batchQueries.push({
            sql: 'UPDATE products SET stock = ? WHERE id = ?',
            params: [newStock, prod.id]
          });

          batchQueries.push({
            sql: `
              INSERT INTO inventory_movements 
                (product_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, notes) 
              VALUES (?, 'sale', ?, ?, ?, ?, ?)
            `,
            params: [prod.id, -reqQty, currentChildStock, newStock, orderNumber, `Venta online, Cliente ID: ${user.id}`]
          });
        } else {
          const missingUnits = reqQty - currentChildStock;
          const boxesToBreak = Math.ceil(missingUnits / prod.unidades_por_padre);
          const currentParentStock = batchRunningStocks[prod.id_producto_padre];
          const newParentStock = currentParentStock - boxesToBreak;
          batchRunningStocks[prod.id_producto_padre] = newParentStock;

          batchQueries.push({
            sql: 'UPDATE products SET stock = ? WHERE id = ?',
            params: [newParentStock, prod.id_producto_padre]
          });

          batchQueries.push({
            sql: `
              INSERT INTO inventory_movements 
                (product_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, notes)
              VALUES (?, 'desglose_parent', ?, ?, ?, ?, ?)
            `,
            params: [
              prod.id_producto_padre,
              -boxesToBreak,
              currentParentStock,
              newParentStock,
              orderNumber,
              `Desglose de ${boxesToBreak} caja(s) de "${prod.parent_name || 'producto padre'}" para surtir "${prod.name}" en Orden ${orderNumber}`
            ]
          });

          const addedUnits = boxesToBreak * prod.unidades_por_padre;
          const tempStock = currentChildStock + addedUnits;
          batchRunningStocks[prod.id] = tempStock;

          batchQueries.push({
            sql: `
              INSERT INTO inventory_movements 
                (product_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, notes)
              VALUES (?, 'desglose_child', ?, ?, ?, ?, ?)
            `,
            params: [
              prod.id,
              addedUnits,
              currentChildStock,
              tempStock,
              orderNumber,
              `Entrada por desglose de ${boxesToBreak} caja(s) de "${prod.parent_name || 'producto padre'}"`
            ]
          });

          const finalStock = tempStock - reqQty;
          batchRunningStocks[prod.id] = finalStock;

          batchQueries.push({
            sql: 'UPDATE products SET stock = ? WHERE id = ?',
            params: [finalStock, prod.id]
          });

          batchQueries.push({
            sql: `
              INSERT INTO inventory_movements 
                (product_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, notes)
              VALUES (?, 'sale', ?, ?, ?, ?, ?)
            `,
            params: [
              prod.id,
              -reqQty,
              tempStock,
              finalStock,
              orderNumber,
              `Venta online, Cliente ID: ${user.id}`
            ]
          });
        }
      }
    }

    if (couponId && finalDiscountAmount > 0) {
      batchQueries.push({
        sql: 'UPDATE coupons SET uses_left = uses_left - 1 WHERE id = ? AND uses_left > 0',
        params: [couponId]
      });
    }

    // Execute all operations inside a single atomic database batch
    let orderId: number;
    try {
      const results = await dbBatch(batchQueries);
      orderId = Number(results[0]?.insertId ?? 0);
    } catch (txError: any) {
      return NextResponse.json({ error: txError.message || 'Error al procesar el pedido en la base de datos.' }, { status: 400 });
    }

    // Fetch user info to send email
    const users = await dbQuery<{ email: string; full_name: string }[]>(
      'SELECT email, full_name FROM users WHERE id = ?',
      [user.id]
    );

    if (users.length) {
      try {
        await sendOrderConfirmationEmail({
          to: users[0].email,
          customerName: users[0].full_name,
          orderNumber,
          items: validatedCartItems.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
          total,
          paymentMethod: selectedPM.name,
        });
      } catch (mailError) {
        console.error('Failed to send order email (non-fatal):', mailError);
      }
    }

    // Emit stock updates for real-time synchronization
    try {
      const { stockEmitter } = require('@/lib/stockEmitter');
      for (const item of validatedCartItems) {
        const prod = productDetailsMap[item.id];
        if (prod) {
          const finalStock = batchRunningStocks[prod.id];
          stockEmitter.emitUpdate(prod.id, finalStock);
          if (prod.id_producto_padre) {
            const parentStock = batchRunningStocks[prod.id_producto_padre];
            stockEmitter.emitUpdate(prod.id_producto_padre, parentStock);
          }
        }
      }
    } catch (e) {
      console.error('Failed to emit stock updates during customer checkout:', e);
    }

    return NextResponse.json({ success: true, orderNumber, orderId });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Error interno al procesar el pedido.' }, { status: 500 });
  }
}
