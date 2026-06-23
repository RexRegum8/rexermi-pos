export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, dbBatch } from '@/lib/db';
import { getPOSSession } from '@/lib/auth';
import { generateOrderNumber } from '@/lib/helpers';
import { getSettings, isCreditAvailable } from '@/lib/settings';

interface CartItem {
  id: number;
  name: string;
  price: number;
  cartQuantity: number;
  type: 'product' | 'service';
}

export async function POST(req: NextRequest) {
  // Verify seller
  const session = await getPOSSession();
  if (!session || (session.role !== 'vendedor' && session.role !== 'admin' && session.role !== 'custom')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { cart, paymentMethod, paymentRef, customerId, paymentProof, orderId, discountAmount, mixedPayments, mixedReferences } = (await req.json()) as any;

    if (!cart || !cart.length) {
      return NextResponse.json({ error: 'El carrito está vacío' }, { status: 400 });
    }

    if (!paymentMethod) {
      return NextResponse.json({ error: 'El método de pago es requerido.' }, { status: 400 });
    }

    let paymentMethodName = '';
    let finalPaymentRef = paymentRef;

    if (paymentMethod === 'Mixto') {
      paymentMethodName = 'Mixto';
      if (!mixedPayments || typeof mixedPayments !== 'object' || Object.keys(mixedPayments).length === 0) {
        return NextResponse.json({ error: 'Debe especificar el desglose de pagos para el método mixto.' }, { status: 400 });
      }

      // Validate mixed components
      const activePMs = await dbQuery<any[]>('SELECT id, name, requires_proof FROM payment_methods WHERE is_active = 1');
      const pmMap = new Map(activePMs.map(pm => [pm.name, pm]));

      for (const [pmName, amount] of Object.entries(mixedPayments)) {
        const amt = Number(amount);
        if (isNaN(amt) || amt <= 0) {
          return NextResponse.json({ error: `El monto para el método ${pmName} debe ser un número válido mayor a 0.` }, { status: 400 });
        }
        const pm = pmMap.get(pmName);
        if (!pm) {
          return NextResponse.json({ error: `El método de pago "${pmName}" en el pago mixto no es válido o está inactivo.` }, { status: 400 });
        }
        if (pm.requires_proof === 1) {
          const ref = mixedReferences?.[pmName];
          if (!ref || !ref.trim()) {
            return NextResponse.json({ error: `La referencia de pago es requerida para el método ${pmName} en el pago mixto.` }, { status: 400 });
          }
        }
      }
    } else {
      // Validate dynamic payment method from DB
      const paymentMethods = await dbQuery<any[]>(
        'SELECT id, name, requires_proof FROM payment_methods WHERE id = ? AND is_active = 1',
        [paymentMethod]
      );
      if (!paymentMethods.length) {
        return NextResponse.json({ error: 'El método de pago seleccionado no es válido o no está activo.' }, { status: 400 });
      }
      const selectedPM = paymentMethods[0];
      paymentMethodName = selectedPM.name;
      const requiresProof = selectedPM.requires_proof === 1;

      if (paymentMethodName === 'Crédito') {
        if (!customerId) {
          return NextResponse.json({ error: 'La venta a crédito requiere seleccionar un cliente registrado.' }, { status: 400 });
        }
        const settings = await getSettings();
        if (!isCreditAvailable(settings)) {
          return NextResponse.json({ error: 'El sistema de crédito no está disponible en este momento (fuera de temporada u horario activo).' }, { status: 400 });
        }
        
        // Ensure user_credits row exists
        const initialPoints = parseInt(settings['loyalty_initial_points'] || '100');
        const multiplier = parseFloat(settings['loyalty_points_to_credit_multiplier'] || '2.0');
        const limit = initialPoints * multiplier;
        
        await dbQuery(`
          INSERT OR IGNORE INTO user_credits (user_id, credit_limit, credit_used, loyalty_points, credit_status)
          VALUES (?, ?, 0.0, ?, 'active')
        `, [customerId, limit, initialPoints]);

        const creditRows = await dbQuery<{ credit_limit: number; credit_used: number; credit_status: string }[]>(
          'SELECT credit_limit, credit_used, credit_status FROM user_credits WHERE user_id = ?',
          [customerId]
        );
        const credit = creditRows[0];
        if (credit.credit_status !== 'active') {
          return NextResponse.json({ error: 'La cuenta de crédito del cliente se encuentra suspendida o anulada.' }, { status: 400 });
        }
      } else if (requiresProof) {
        if (!paymentRef || !paymentRef.trim()) {
          return NextResponse.json({ error: `La referencia de pago es requerida para el método ${selectedPM.name}.` }, { status: 400 });
        }
        if (!paymentProof) {
          return NextResponse.json({ error: `El comprobante de pago es requerido para el método ${selectedPM.name}.` }, { status: 400 });
        }
      }
    }

    // Restore stock simulation if orderId is provided
    let oldItems: { product_id: number; quantity: number }[] = [];
    if (orderId) {
      oldItems = await dbQuery<{ product_id: number; quantity: number }[]>(
        'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
        [orderId]
      );
    }

    const productIdsToFetch = new Set<number>();
    for (const item of cart) {
      if (item.id > 0) productIdsToFetch.add(item.id);
    }
    for (const item of oldItems) {
      if (item.product_id && item.product_id > 0) productIdsToFetch.add(item.product_id);
    }

    const productDetailsMap: Record<number, any> = {};
    for (const id of productIdsToFetch) {
      const dbProducts = await dbQuery<{ id: number; name: string; price: number; stock: number; type: 'product' | 'service'; is_active: number; es_subproducto: number; id_producto_padre: number | null; unidades_por_padre: number | null; parent_stock: number | null; parent_name: string | null }[]>(
        `SELECT p.id, p.name, p.price, p.stock, p.type, p.is_active,
                p.es_subproducto, p.id_producto_padre, p.unidades_por_padre,
                parent.stock AS parent_stock, parent.name AS parent_name
         FROM products p
         LEFT JOIN products parent ON p.id_producto_padre = parent.id
         WHERE p.id = ?`,
        [id]
      );
      if (dbProducts.length) {
        productDetailsMap[id] = dbProducts[0];
      }
    }

    const runningStocks: Record<number, number> = {};
    for (const id in productDetailsMap) {
      const prod = productDetailsMap[Number(id)];
      runningStocks[prod.id] = prod.stock;
      if (prod.id_producto_padre !== null && runningStocks[prod.id_producto_padre] === undefined) {
        runningStocks[prod.id_producto_padre] = prod.parent_stock !== null ? prod.parent_stock : 0;
      }
    }

    if (orderId) {
      for (const oldItem of oldItems) {
        const prod = productDetailsMap[oldItem.product_id];
        if (prod && prod.type === 'product') {
          runningStocks[oldItem.product_id] += oldItem.quantity;
        }
      }
    }

    let calculatedSubtotal = 0;
    const validatedCartItems = [];

    // Double check stock and validate prices server-side
    for (const item of cart) {
      if (item.id <= 0) {
        // Generic/custom product: skip DB price/stock checks and treat as service
        calculatedSubtotal += item.price * item.cartQuantity;
        validatedCartItems.push({
          id: item.id,
          name: item.name,
          price: item.price,
          cartQuantity: item.cartQuantity,
          type: 'service',
          stock: 999999
        });
        continue;
      }

      const dbProd = productDetailsMap[item.id];
      if (!dbProd || dbProd.is_active !== 1) {
        return NextResponse.json({ error: `El producto o servicio "${item.name || ('ID: ' + item.id)}" ya no está disponible.` }, { status: 400 });
      }

      if (dbProd.type === 'product') {
        const childStock = runningStocks[dbProd.id];
        let availableStock = childStock;
        
        if (dbProd.es_subproducto === 1 && dbProd.id_producto_padre !== null && dbProd.unidades_por_padre !== null && dbProd.unidades_por_padre > 0) {
          const parentStock = runningStocks[dbProd.id_producto_padre];
          availableStock = childStock + (parentStock * dbProd.unidades_por_padre);
        }

        if (availableStock < item.cartQuantity) {
          if (dbProd.es_subproducto === 1 && dbProd.id_producto_padre !== null) {
            const parentStock = runningStocks[dbProd.id_producto_padre];
            return NextResponse.json(
              { error: `Stock insuficiente. Solo quedan ${childStock} unidades de "${dbProd.name}" y ${parentStock} cajas de "${dbProd.parent_name || 'producto padre'}" (Total disponible: ${availableStock} unidades).` },
              { status: 400 }
            );
          } else {
            return NextResponse.json(
              { error: `Solo quedan ${childStock} unidades de "${dbProd.name}" (Llevas en carrito ${item.cartQuantity}, disponible: ${availableStock}).` },
              { status: 400 }
            );
          }
        }

        const reqQty = item.cartQuantity;
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
      
      calculatedSubtotal += dbProd.price * item.cartQuantity;
      validatedCartItems.push({
        id: dbProd.id,
        name: dbProd.name,
        price: dbProd.price,
        cartQuantity: item.cartQuantity,
        type: dbProd.type,
        stock: dbProd.stock
      });
    }

    const finalDiscount = Number(discountAmount) || 0;
    if (finalDiscount < 0) {
      return NextResponse.json({ error: 'El descuento no puede ser negativo.' }, { status: 400 });
    }
    if (finalDiscount > calculatedSubtotal) {
      return NextResponse.json({ error: 'El descuento no puede superar el subtotal de la compra.' }, { status: 400 });
    }
    const finalTotal = Math.max(0, calculatedSubtotal - finalDiscount);

    if (paymentMethodName === 'Crédito') {
      const creditRows = await dbQuery<{ credit_limit: number; credit_used: number }[]>(
        'SELECT credit_limit, credit_used FROM user_credits WHERE user_id = ?',
        [customerId]
      );
      if (creditRows.length) {
        const credit = creditRows[0];
        const available = credit.credit_limit - credit.credit_used;
        if (available < finalTotal) {
          return NextResponse.json({ error: `Crédito insuficiente. Disponible: $${available.toFixed(2)}, Requerido: $${finalTotal.toFixed(2)}` }, { status: 400 });
        }
      }
    }

    if (paymentMethod === 'Mixto') {
      let mixedSum = 0;
      for (const amount of Object.values(mixedPayments)) {
        mixedSum += Number(amount);
      }
      if (Math.abs(mixedSum - finalTotal) >= 0.01) {
        return NextResponse.json({ error: `La suma de los pagos mixtos (${mixedSum.toFixed(2)}) no coincide con el total de la venta (${finalTotal.toFixed(2)}).` }, { status: 400 });
      }
      finalPaymentRef = JSON.stringify({ breakdown: mixedPayments, references: mixedReferences || {} });
    }

    let orderNumber = '';
    if (orderId) {
      const originalOrders = await dbQuery<{ order_number: string }[]>('SELECT order_number FROM orders WHERE id = ?', [orderId]);
      if (!originalOrders.length) {
        return NextResponse.json({ error: 'El pedido original no existe.' }, { status: 404 });
      }
      orderNumber = originalOrders[0].order_number;
    } else {
      orderNumber = generateOrderNumber('POS');
    }

    let proofFilename: string | null = null;
    let capturePathForNotes = '';

    if (paymentProof && paymentProof.length > 7 * 1024 * 1024) {
      return NextResponse.json({ error: 'El comprobante de pago supera el tamaño máximo permitido (5MB).' }, { status: 400 });
    }

    // Handle base64 image saving to private directory
    if (paymentProof && paymentProof.startsWith('data:image')) {
      try {
        const matches = paymentProof.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          proofFilename = `pos-capture-${Date.now()}.${extension}`;
          
          if (typeof EdgeRuntime !== 'string') {
            const requireFunc = typeof __webpack_require__ === "function" ? __non_webpack_require__ : require;
            const fsLib = requireFunc('fs').promises;
            const pathLib = requireFunc('path');
            const filePath = pathLib.join(process['cwd'](), 'private', 'receipts', proofFilename);
            await fsLib.mkdir(pathLib.dirname(filePath), { recursive: true });
            await fsLib.writeFile(filePath, buffer);
          } else {
            console.log('Running on Cloudflare Edge: skipping physical receipt file write on disk.');
          }
          capturePathForNotes = `/api/receipts/${proofFilename}`;
        }
      } catch (e) {
        console.error('Error saving POS capture:', e);
      }
    }

    const finalNotes = `Atendido por: ${session.fullName}${capturePathForNotes ? `\nComprobante: ${capturePathForNotes}` : ''}`;

    // Verify cash closure
    const activeClosures = await dbQuery<{ id: number }[]>(
      "SELECT id FROM cash_closures WHERE user_id = ? AND status = 'open'",
      [session.id]
    );
    if (!activeClosures.length) {
      return NextResponse.json({ error: 'Debes abrir una caja (iniciar turno) antes de realizar ventas.' }, { status: 400 });
    }
    const closureId = activeClosures[0].id;

    // Compile all database statements for the transaction batch
    const batchQueries: { sql: string; params?: any[] }[] = [];

    if (orderId) {
      // 1. Restore stock of original items in DB
      const restoreRunningStocks: Record<number, number> = {};
      for (const id in productDetailsMap) {
        restoreRunningStocks[Number(id)] = productDetailsMap[Number(id)].stock;
      }

      for (const oldItem of oldItems) {
        const prod = productDetailsMap[oldItem.product_id];
        if (prod && prod.type === 'product') {
          const prevStock = restoreRunningStocks[prod.id];
          const newStock = prevStock + oldItem.quantity;
          restoreRunningStocks[prod.id] = newStock;

          batchQueries.push({
            sql: 'UPDATE products SET stock = stock + ? WHERE id = ?',
            params: [oldItem.quantity, oldItem.product_id]
          });

          batchQueries.push({
            sql: `
              INSERT INTO inventory_movements 
                (product_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, notes) 
              VALUES (?, 'pos_adjust_restore', ?, ?, ?, ?, ?)
            `,
            params: [
              oldItem.product_id,
              oldItem.quantity,
              prevStock,
              newStock,
              orderNumber,
              `Restauración por recálculo de POS por ${session.fullName}`
            ]
          });
        }
      }

      // 2. Delete old order items
      batchQueries.push({
        sql: 'DELETE FROM order_items WHERE order_id = ?',
        params: [orderId]
      });

      // 3. Update existing order details
      batchQueries.push({
        sql: `
          UPDATE orders 
          SET status = 'delivered', subtotal = ?, shipping_cost = 0, total = ?, payment_method = ?, payment_ref = ?, payment_proof = ?, customer_message = 'Venta modificada y facturada en POS', admin_notes = ?, user_id = COALESCE(?, user_id), cash_closure_id = COALESCE(?, cash_closure_id)
          WHERE id = ?
        `,
        params: [
          calculatedSubtotal.toFixed(2),
          finalTotal.toFixed(2),
          paymentMethodName,
          finalPaymentRef || null,
          proofFilename,
          finalNotes,
          customerId || null,
          closureId,
          orderId
        ]
      });
    } else {
      // 1. Insert new order
      batchQueries.push({
        sql: `
          INSERT INTO orders 
            (order_number, user_id, status, subtotal, shipping_cost, total, payment_method, payment_ref, payment_proof, customer_message, admin_notes, cash_closure_id)
          VALUES (?, ?, 'delivered', ?, 0, ?, ?, ?, ?, 'Venta directa en mostrador', ?, ?)
        `,
        params: [
          orderNumber,
          customerId || null,
          calculatedSubtotal.toFixed(2),
          finalTotal.toFixed(2),
          paymentMethodName,
          finalPaymentRef || null,
          proofFilename,
          finalNotes,
          closureId
        ]
      });
    }

    if (paymentMethodName === 'Crédito') {
      const parsedTotal = finalTotal;
      batchQueries.push({
        sql: 'UPDATE user_credits SET credit_used = credit_used + ? WHERE user_id = ?',
        params: [parsedTotal, customerId]
      });

      const settings = await getSettings();
      const pointsPerDollar = parseFloat(settings['loyalty_points_per_dollar'] || '0.1');
      const pointsEarned = Math.floor(parsedTotal * pointsPerDollar) || 1;
      const multiplier = parseFloat(settings['loyalty_points_to_credit_multiplier'] || '2.0');

      batchQueries.push({
        sql: 'UPDATE user_credits SET loyalty_points = loyalty_points + ?, credit_limit = (loyalty_points + ?) * ? WHERE user_id = ?',
        params: [pointsEarned, pointsEarned, multiplier, customerId]
      });

      batchQueries.push({
        sql: `
          INSERT INTO credit_history (user_id, amount_change, movement_type, reference_id, notes)
          VALUES (?, ?, 'purchase', ?, ?)
        `,
        params: [customerId, parsedTotal, orderNumber, `Compra a crédito en POS. Orden ${orderNumber}`]
      });

      batchQueries.push({
        sql: `
          INSERT INTO loyalty_history (user_id, points_change, reason, reference_id)
          VALUES (?, ?, 'Compra a crédito en POS', ?)
        `,
        params: [customerId, pointsEarned, orderNumber]
      });
    }

    // Reset batch running stocks using restored stocks for sale deduction simulation
    const batchRunningStocks: Record<number, number> = {};
    for (const id in productDetailsMap) {
      const prod = productDetailsMap[Number(id)];
      batchRunningStocks[prod.id] = prod.stock;
      if (prod.id_producto_padre !== null && batchRunningStocks[prod.id_producto_padre] === undefined) {
        batchRunningStocks[prod.id_producto_padre] = prod.parent_stock !== null ? prod.parent_stock : 0;
      }
    }
    if (orderId) {
      for (const oldItem of oldItems) {
        const prod = productDetailsMap[oldItem.product_id];
        if (prod && prod.type === 'product') {
          batchRunningStocks[oldItem.product_id] += oldItem.quantity;
        }
      }
    }

    for (const item of validatedCartItems) {
      if (item.id <= 0) {
        batchQueries.push({
          sql: `INSERT INTO order_items (order_id, product_id, product_name, price, quantity, subtotal) VALUES (${orderId ? '?' : '(SELECT id FROM orders WHERE order_number = ?)'}, null, ?, ?, ?, ?)`,
          params: [
            ...(orderId ? [orderId] : [orderNumber]),
            item.name,
            item.price.toFixed(2),
            item.cartQuantity,
            (item.price * item.cartQuantity).toFixed(2)
          ]
        });
        continue;
      }

      batchQueries.push({
        sql: `INSERT INTO order_items (order_id, product_id, product_name, price, quantity, subtotal) VALUES (${orderId ? '?' : '(SELECT id FROM orders WHERE order_number = ?)'}, ?, ?, ?, ?, ?)`,
        params: [
          ...(orderId ? [orderId] : [orderNumber]),
          item.id,
          item.name,
          item.price.toFixed(2),
          item.cartQuantity,
          (item.price * item.cartQuantity).toFixed(2)
        ]
      });

      const prod = productDetailsMap[item.id];
      if (prod && prod.type === 'product') {
        const reqQty = item.cartQuantity;
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
            params: [prod.id, -reqQty, currentChildStock, newStock, orderNumber, `Venta en POS por ${session.fullName}`]
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
              `Desglose de ${boxesToBreak} caja(s) de "${prod.parent_name || 'producto padre'}" para surtir "${prod.name}" en POS`
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
              `Venta en POS por ${session.fullName}`
            ]
          });
        }
      }
    }

    try {
      await dbBatch(batchQueries);
    } catch (txError: any) {
      console.error('POS Checkout Transaction error:', txError);
      return NextResponse.json({ error: txError.message || 'Error al procesar la venta en la base de datos.' }, { status: 400 });
    }

    // Emit stock updates for real-time synchronization
    try {
      const { stockEmitter } = require('@/lib/stockEmitter');
      for (const item of validatedCartItems) {
        if (item.id <= 0) continue;
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
      console.error('Failed to emit stock updates during POS checkout:', e);
    }

    return NextResponse.json({ success: true, orderNumber });
  } catch (error) {
    console.error('POS Checkout error:', error);
    return NextResponse.json({ error: 'Error procesando la venta' }, { status: 500 });
  }
}
