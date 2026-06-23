import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, dbBatch } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    // 1. Get default configs for fallbacks
    const initialPointsRow = await dbQuery<{ value: string }[]>("SELECT value FROM settings WHERE key = 'loyalty_initial_points'");
    const initialPoints = parseInt(initialPointsRow[0]?.value || '100');
    const multiplierRow = await dbQuery<{ value: string }[]>("SELECT value FROM settings WHERE key = 'loyalty_points_to_credit_multiplier'");
    const multiplier = parseFloat(multiplierRow[0]?.value || '2.0');
    const defaultLimit = initialPoints * multiplier;

    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');

    if (userId) {
      const parsedUserId = parseInt(userId, 10);
      if (isNaN(parsedUserId)) {
        return NextResponse.json({ error: 'ID de usuario inválido.' }, { status: 400 });
      }

      const clients = await dbQuery<any[]>(`
        SELECT 
          u.id as user_id,
          u.full_name,
          u.email,
          u.phone,
          u.id_document,
          uc.credit_limit,
          uc.credit_used,
          uc.loyalty_points,
          uc.credit_status
        FROM users u
        LEFT JOIN user_credits uc ON u.id = uc.user_id
        WHERE u.id = ? AND u.role = 'user'
      `, [parsedUserId]);

      if (clients.length === 0) {
        return NextResponse.json({ error: 'Cliente no encontrado.' }, { status: 404 });
      }

      const c = clients[0];
      const formattedClient = {
        user_id: c.user_id,
        full_name: c.full_name,
        email: c.email || '',
        phone: c.phone || '',
        id_document: c.id_document || '',
        credit_limit: c.credit_limit !== null && c.credit_limit !== undefined ? c.credit_limit : defaultLimit,
        credit_used: c.credit_used !== null && c.credit_used !== undefined ? c.credit_used : 0.0,
        loyalty_points: c.loyalty_points !== null && c.loyalty_points !== undefined ? c.loyalty_points : initialPoints,
        credit_status: c.credit_status || 'active',
      };

      // Fetch history
      const creditHistory = await dbQuery<any[]>(`
        SELECT * FROM credit_history WHERE user_id = ? ORDER BY created_at DESC
      `, [parsedUserId]);

      const loyaltyHistory = await dbQuery<any[]>(`
        SELECT * FROM loyalty_history WHERE user_id = ? ORDER BY created_at DESC
      `, [parsedUserId]);

      return NextResponse.json({
        success: true,
        client: formattedClient,
        creditHistory,
        loyaltyHistory
      });
    }

    // 2. Query clients
    const clients = await dbQuery<any[]>(`
      SELECT 
        u.id as user_id,
        u.full_name,
        u.email,
        u.phone,
        u.id_document,
        uc.credit_limit,
        uc.credit_used,
        uc.loyalty_points,
        uc.credit_status
      FROM users u
      LEFT JOIN user_credits uc ON u.id = uc.user_id
      WHERE u.role = 'user'
      ORDER BY u.full_name ASC
    `);

    // 3. Apply default fallbacks where row is missing
    const formattedClients = clients.map(c => ({
      user_id: c.user_id,
      full_name: c.full_name,
      email: c.email || '',
      phone: c.phone || '',
      id_document: c.id_document || '',
      credit_limit: c.credit_limit !== null && c.credit_limit !== undefined ? c.credit_limit : defaultLimit,
      credit_used: c.credit_used !== null && c.credit_used !== undefined ? c.credit_used : 0.0,
      loyalty_points: c.loyalty_points !== null && c.loyalty_points !== undefined ? c.loyalty_points : initialPoints,
      credit_status: c.credit_status || 'active',
    }));

    return NextResponse.json({ success: true, clients: formattedClients });
  } catch (error) {
    console.error('Failed to get credit clients:', error);
    return NextResponse.json({ error: 'Error al obtener cartera de clientes.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const { action, userId, amount, points, limit, status, notes } = (await req.json()) as any;
    if (!userId) {
      return NextResponse.json({ error: 'ID de usuario requerido.' }, { status: 400 });
    }

    // 1. Get default settings for fallbacks if needed
    const initialPointsRow = await dbQuery<{ value: string }[]>("SELECT value FROM settings WHERE key = 'loyalty_initial_points'");
    const initialPoints = parseInt(initialPointsRow[0]?.value || '100');
    const multiplierRow = await dbQuery<{ value: string }[]>("SELECT value FROM settings WHERE key = 'loyalty_points_to_credit_multiplier'");
    const multiplier = parseFloat(multiplierRow[0]?.value || '2.0');
    const defaultLimit = initialPoints * multiplier;

    try {
      // Ensure user_credits row exists, lock row by reading
      const creditRows = await dbQuery<any[]>("SELECT * FROM user_credits WHERE user_id = ?", [userId]);
      let credit = creditRows[0];
      if (!credit) {
        await dbQuery(`
          INSERT INTO user_credits (user_id, credit_limit, credit_used, loyalty_points, credit_status)
          VALUES (?, ?, 0.0, ?, 'active')
        `, [userId, defaultLimit, initialPoints]);
        credit = { credit_limit: defaultLimit, credit_used: 0.0, loyalty_points: initialPoints, credit_status: 'active' };
      }

      if (action === 'payment') {
        // Register a credit payment
        const payAmt = parseFloat(amount);
        if (isNaN(payAmt) || payAmt <= 0) {
          throw new Error('El monto de abono debe ser mayor a 0.');
        }
        if (payAmt > credit.credit_used) {
          throw new Error(`El abono ($${payAmt}) supera la deuda actual ($${credit.credit_used}).`);
        }

        // Calculate loyalty points reward based on points_per_dollar
        const pointsPerDollarRow = await dbQuery<{ value: string }[]>("SELECT value FROM settings WHERE key = 'loyalty_points_per_dollar'");
        const pointsPerDollar = parseFloat(pointsPerDollarRow[0]?.value || '0.1');
        const pointsEarned = Math.floor(payAmt * pointsPerDollar) || 1; // Give at least 1 point for paying

        const newDebt = credit.credit_used - payAmt;
        const newPoints = credit.loyalty_points + pointsEarned;
        // Recalculate limit based on points * multiplier
        const newLimit = newPoints * multiplier;

        // Run updates in a single batch
        await dbBatch([
          {
            sql: `
              UPDATE user_credits 
              SET credit_used = ?, loyalty_points = ?, credit_limit = ?
              WHERE user_id = ?
            `,
            params: [newDebt, newPoints, newLimit, userId]
          },
          {
            sql: `
              INSERT INTO credit_history (user_id, amount_change, movement_type, reference_id, notes)
              VALUES (?, ?, 'payment', 'Abono', ?)
            `,
            params: [userId, -payAmt, notes || `Abono de deuda por $${payAmt.toFixed(2)} registrado por admin.`]
          },
          {
            sql: `
              INSERT INTO loyalty_history (user_id, points_change, reason, reference_id)
              VALUES (?, ?, 'Abono de deuda a crédito', 'Abono')
            `,
            params: [userId, pointsEarned, `Pago registrado de $${payAmt.toFixed(2)}`]
          }
        ]);

      } else if (action === 'adjust') {
        // Adjust limits, points, and status manually
        const newPoints = parseInt(points);
        const newLimit = parseFloat(limit);
        if (isNaN(newPoints) || newPoints < 0) throw new Error('Puntos inválidos.');
        if (isNaN(newLimit) || newLimit < 0) throw new Error('Límite de crédito inválido.');
        if (!['active', 'suspended', 'cancelled'].includes(status)) throw new Error('Estado inválido.');

        const batchOps: { sql: string; params: any[] }[] = [];

        // Log points history if points changed
        if (newPoints !== credit.loyalty_points) {
          batchOps.push({
            sql: `
              INSERT INTO loyalty_history (user_id, points_change, reason, reference_id)
              VALUES (?, ?, 'Ajuste administrativo', 'Ajuste')
            `,
            params: [userId, newPoints - credit.loyalty_points]
          });
        }

        // Log credit limit adjustment if limit or status changed
        if (newLimit !== credit.credit_limit || status !== credit.credit_status) {
          batchOps.push({
            sql: `
              INSERT INTO credit_history (user_id, amount_change, movement_type, reference_id, notes)
              VALUES (?, 0.0, 'adjustment', 'Ajuste', ?)
            `,
            params: [userId, `Ajuste manual: límite anterior $${credit.credit_limit} -> $${newLimit}, estado anterior ${credit.credit_status} -> ${status}`]
          });
        }

        // Update DB
        batchOps.push({
          sql: `
            UPDATE user_credits 
            SET loyalty_points = ?, credit_limit = ?, credit_status = ?
            WHERE user_id = ?
          `,
          params: [newPoints, newLimit, status, userId]
        });

        await dbBatch(batchOps);

      } else {
        throw new Error('Acción no admitida.');
      }
    } catch (txError: any) {
      return NextResponse.json({ error: txError.message || 'Error en la transacción de actualización.' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update client credit:', error);
    return NextResponse.json({ error: 'Error al actualizar los datos crediticios.' }, { status: 500 });
  }
}
