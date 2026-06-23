import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { getPOSSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getPOSSession();
  if (!session || (session.role !== 'vendedor' && session.role !== 'admin' && session.role !== 'custom')) {

    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const closures = await dbQuery<any[]>(
      "SELECT * FROM cash_closures WHERE user_id = ? AND status = 'open'",
      [session.id]
    );

    if (!closures.length) {
      return NextResponse.json({ success: true, activeClosure: null });
    }

    const closure = closures[0];

    // Calculate expected amount and payment breakdown dynamically (including mixed payments)
    const orders = await dbQuery<any[]>(
      "SELECT total, payment_method, payment_ref FROM orders WHERE cash_closure_id = ?",
      [closure.id]
    );

    let cashSales = 0;
    const breakdownMap: Record<string, { count: number; total: number }> = {};
    
    orders.forEach(order => {
      if (order.payment_method === 'Efectivo') {
        cashSales += order.total;
        if (!breakdownMap['Efectivo']) breakdownMap['Efectivo'] = { count: 0, total: 0 };
        breakdownMap['Efectivo'].count += 1;
        breakdownMap['Efectivo'].total += order.total;
      } else if (order.payment_method === 'Mixto') {
        try {
          const parsed = JSON.parse(order.payment_ref || '{}');
          const breakdown = parsed.breakdown || {};
          
          Object.entries(breakdown).forEach(([method, amount]) => {
            const numAmount = Number(amount);
            if (method === 'Efectivo') {
              cashSales += numAmount;
            }
            if (!breakdownMap[method]) breakdownMap[method] = { count: 0, total: 0 };
            breakdownMap[method].total += numAmount;
          });
          
          if (!breakdownMap['Mixto']) breakdownMap['Mixto'] = { count: 0, total: 0 };
          breakdownMap['Mixto'].count += 1;
          breakdownMap['Mixto'].total += order.total;
        } catch (e) {
          console.error('Failed to parse mixed payment breakdown:', e);
        }
      } else {
        const method = order.payment_method || 'Otros';
        if (!breakdownMap[method]) breakdownMap[method] = { count: 0, total: 0 };
        breakdownMap[method].count += 1;
        breakdownMap[method].total += order.total;
      }
    });

    // Fetch any payments made to customer credits during this cash closure
    const creditPayments = await dbQuery<any[]>(
      "SELECT amount_change, payment_method FROM credit_history WHERE cash_closure_id = ? AND movement_type = 'payment'",
      [closure.id]
    );

    creditPayments.forEach(payment => {
      const payAmt = -payment.amount_change; // amount_change is stored negative for payments
      const method = payment.payment_method || 'Efectivo';
      
      if (method === 'Efectivo') {
        cashSales += payAmt;
      }
      if (!breakdownMap[method]) breakdownMap[method] = { count: 0, total: 0 };
      breakdownMap[method].count += 1;
      breakdownMap[method].total += payAmt;
    });

    const expectedAmount = closure.opening_amount + cashSales;

    const paymentsBreakdown = Object.entries(breakdownMap).map(([method, data]) => ({
      payment_method: method,
      count: data.count,
      total: data.total
    }));

    return NextResponse.json({
      success: true,
      activeClosure: {
        ...closure,
        expected_amount: expectedAmount,
        cash_sales: cashSales,
        paymentsBreakdown
      }
    });
  } catch (error) {
    console.error('Error fetching cash closure:', error);
    return NextResponse.json({ error: 'Error al obtener el estado de la caja.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getPOSSession();
  if (!session || (session.role !== 'vendedor' && session.role !== 'admin' && session.role !== 'custom')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { opening_amount, notes } = (await req.json()) as any;

    if (opening_amount === undefined || opening_amount === null || isNaN(Number(opening_amount))) {
      return NextResponse.json({ error: 'El monto de apertura es requerido y debe ser un número.' }, { status: 400 });
    }

    // Check and open closure
    let insertId: number;
    const active = await dbQuery("SELECT id FROM cash_closures WHERE user_id = ? AND status = 'open'", [session.id]);
    if (active.length > 0) {
      return NextResponse.json({ error: 'Ya tienes un turno de caja abierto.' }, { status: 400 });
    }

    const openedAt = new Date().toISOString();
    const info = await dbQuery(
      `INSERT INTO cash_closures (user_id, opened_at, opening_amount, expected_amount, notes, status)
       VALUES (?, ?, ?, ?, ?, 'open')`,
      [session.id, openedAt, Number(opening_amount), Number(opening_amount), notes || '']
    );
    insertId = Number(info.insertId);

    return NextResponse.json({
      success: true,
      message: 'Caja abierta correctamente.',
      closureId: Number(insertId)
    });
  } catch (error) {
    console.error('Error opening cash closure:', error);
    return NextResponse.json({ error: 'Error al abrir la caja.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getPOSSession();
  if (!session || (session.role !== 'vendedor' && session.role !== 'admin' && session.role !== 'custom')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { actual_amount, notes } = (await req.json()) as any;

    if (actual_amount === undefined || actual_amount === null || isNaN(Number(actual_amount))) {
      return NextResponse.json({ error: 'El monto real contado es requerido y debe ser un número.' }, { status: 400 });
    }

    // Get the active closure
    const activeClosures = await dbQuery<any[]>(
      "SELECT * FROM cash_closures WHERE user_id = ? AND status = 'open'",
      [session.id]
    );

    if (!activeClosures.length) {
      return NextResponse.json({ error: 'No tienes ningún turno de caja abierto para cerrar.' }, { status: 400 });
    }

    const closure = activeClosures[0];

    // Calculate final expected amount including cash portion of mixed payments
    const orders = await dbQuery<any[]>(
      "SELECT total, payment_method, payment_ref FROM orders WHERE cash_closure_id = ?",
      [closure.id]
    );

    let cashSales = 0;
    orders.forEach(order => {
      if (order.payment_method === 'Efectivo') {
        cashSales += order.total;
      } else if (order.payment_method === 'Mixto') {
        try {
          const parsed = JSON.parse(order.payment_ref || '{}');
          const breakdown = parsed.breakdown || {};
          if (breakdown.Efectivo) {
            cashSales += Number(breakdown.Efectivo);
          }
        } catch (e) {
          console.error('Failed to parse mixed payment breakdown:', e);
        }
      }
    });
    // Sum cash abonos as well
    const creditPayments = await dbQuery<any[]>(
      "SELECT amount_change FROM credit_history WHERE cash_closure_id = ? AND movement_type = 'payment' AND payment_method = 'Efectivo'",
      [closure.id]
    );
    creditPayments.forEach(payment => {
      cashSales += -payment.amount_change;
    });

    const expectedAmount = closure.opening_amount + cashSales;

    const closedAt = new Date().toISOString();
    const finalNotes = notes || closure.notes || '';

    await dbQuery(
      `UPDATE cash_closures
       SET status = 'closed', closed_at = ?, expected_amount = ?, actual_amount = ?, notes = ?
       WHERE id = ?`,
      [closedAt, expectedAmount, Number(actual_amount), finalNotes, closure.id]
    );

    const discrepancy = Number(actual_amount) - expectedAmount;

    return NextResponse.json({
      success: true,
      message: 'Caja cerrada correctamente.',
      closure: {
        id: closure.id,
        opening_amount: closure.opening_amount,
        expected_amount: expectedAmount,
        actual_amount: Number(actual_amount),
        discrepancy,
        closed_at: closedAt
      }
    });
  } catch (error) {
    console.error('Error closing cash closure:', error);
    return NextResponse.json({ error: 'Error al cerrar la caja.' }, { status: 500 });
  }
}
