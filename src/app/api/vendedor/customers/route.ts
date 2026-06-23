import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, dbBatch } from '@/lib/db';
import { getPOSSession, hashPassword } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getPOSSession();
  if (!session || (session.role !== 'vendedor' && session.role !== 'admin' && session.role !== 'custom')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const doc = searchParams.get('doc');

  if (!doc) {
    return NextResponse.json({ error: 'Se requiere un término de búsqueda' }, { status: 400 });
  }

  try {
    const term = `%${doc.trim()}%`;
    
    // Fetch settings for default credit limit fallback
    const initialPointsRow = await dbQuery<{ value: string }[]>("SELECT value FROM settings WHERE key = 'loyalty_initial_points'");
    const initialPoints = parseInt(initialPointsRow[0]?.value || '100');
    const multiplierRow = await dbQuery<{ value: string }[]>("SELECT value FROM settings WHERE key = 'loyalty_points_to_credit_multiplier'");
    const multiplier = parseFloat(multiplierRow[0]?.value || '2.0');
    const defaultLimit = initialPoints * multiplier;

    const users = await dbQuery<any[]>(
      `SELECT u.id, u.full_name, u.id_document, u.email, u.phone,
              uc.credit_limit, uc.credit_used, uc.loyalty_points, uc.credit_status
       FROM users u 
       LEFT JOIN user_credits uc ON u.id = uc.user_id
       WHERE (u.id_document LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?) AND u.role = 'user' 
       LIMIT 5`, 
      [term, term, term]
    );

    const formattedUsers = users.map(u => ({
      id: u.id,
      full_name: u.full_name,
      id_document: u.id_document,
      email: u.email,
      phone: u.phone,
      credit_limit: u.credit_limit !== null && u.credit_limit !== undefined ? u.credit_limit : defaultLimit,
      credit_used: u.credit_used !== null && u.credit_used !== undefined ? u.credit_used : 0.0,
      loyalty_points: u.loyalty_points !== null && u.loyalty_points !== undefined ? u.loyalty_points : initialPoints,
      credit_status: u.credit_status || 'active'
    }));

    return NextResponse.json({ success: true, customers: formattedUsers });
  } catch (error) {
    console.error('POS Customer search error:', error);
    return NextResponse.json({ error: 'Error en la base de datos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getPOSSession();
  if (!session || (session.role !== 'vendedor' && session.role !== 'admin' && session.role !== 'custom')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { full_name, id_document, email, phone } = (await req.json()) as any;
    
    if (!full_name) {
      return NextResponse.json({ error: 'El nombre es obligatorio.' }, { status: 400 });
    }

    // 1. Validate id_document
    if (id_document && id_document.trim() !== '') {
      const cleanDoc = id_document.trim();
      const existingDoc = await dbQuery<any[]>('SELECT id FROM users WHERE LOWER(TRIM(id_document)) = LOWER(TRIM(?))', [cleanDoc]);
      if (existingDoc.length > 0) {
        return NextResponse.json({ error: 'La Cédula / RIF ya está registrada por otro usuario.' }, { status: 400 });
      }
    }

    // 2. Validate email
    const finalEmail = email ? email.toLowerCase().trim() : (id_document ? `${id_document.trim()}@pos.local` : null);
    if (finalEmail) {
      const existingEmail = await dbQuery<any[]>('SELECT id FROM users WHERE email = ?', [finalEmail]);
      if (existingEmail.length > 0) {
        return NextResponse.json({ error: 'El correo electrónico ya está registrado por otro usuario.' }, { status: 400 });
      }
    }

    // 3. Validate phone
    if (phone && phone.trim() !== '' && phone.trim() !== '—') {
      const cleanPhone = phone.trim();
      const existingPhone = await dbQuery<any[]>('SELECT id FROM users WHERE TRIM(phone) = TRIM(?)', [cleanPhone]);
      if (existingPhone.length > 0) {
        return NextResponse.json({ error: 'El número de teléfono ya está registrado por otro usuario.' }, { status: 400 });
      }
    }

    // Quick register (generates a random password since it's just for POS linking)
    const randomPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await hashPassword(randomPassword);

    // Fetch settings for default credit limit fallback
    const initialPointsRow = await dbQuery<{ value: string }[]>("SELECT value FROM settings WHERE key = 'loyalty_initial_points'");
    const initialPoints = parseInt(initialPointsRow[0]?.value || '100');
    const multiplierRow = await dbQuery<{ value: string }[]>("SELECT value FROM settings WHERE key = 'loyalty_points_to_credit_multiplier'");
    const multiplier = parseFloat(multiplierRow[0]?.value || '2.0');
    const defaultLimit = initialPoints * multiplier;

    const result = await dbQuery<{ insertId: number }>(
      'INSERT INTO users (full_name, id_document, email, phone, password, role, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [full_name.trim(), id_document || null, finalEmail, phone || '', hashedPassword, 'user']
    );

    return NextResponse.json({ 
      success: true, 
      customer: { 
        id: (result as any).insertId, 
        full_name: full_name.trim(), 
        id_document, 
        email: finalEmail, 
        phone,
        credit_limit: defaultLimit,
        credit_used: 0.0,
        loyalty_points: initialPoints,
        credit_status: 'active'
      } 
    });
  } catch (error: any) {
    console.error('POS Customer Register Error:', error);
    return NextResponse.json({ error: 'Error al registrar cliente' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getPOSSession();
  if (!session || (session.role !== 'vendedor' && session.role !== 'admin' && session.role !== 'custom')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { customerId, amount, paymentMethod, reference } = (await req.json()) as any;

    if (!customerId || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Monto y Cliente válidos son obligatorios.' }, { status: 400 });
    }

    if (!paymentMethod) {
      return NextResponse.json({ error: 'Método de pago es obligatorio.' }, { status: 400 });
    }

    // Check if there is an active cash closure for the user
    const activeClosures = await dbQuery<any[]>("SELECT id FROM cash_closures WHERE user_id = ? AND status = 'open'", [session.id]);
    const activeClosure = activeClosures[0];
    if (!activeClosure) {
      return NextResponse.json({ error: 'Debe abrir caja antes de recibir un pago.' }, { status: 400 });
    }

    const payAmt = Number(amount);

    // 1. Get customer credit details
    const creditRows = await dbQuery<any[]>('SELECT * FROM user_credits WHERE user_id = ?', [customerId]);
    let credit = creditRows[0];
    
    // If no credit profile exists, create one
    if (!credit) {
      const initialPointsRow = await dbQuery<{ value: string }[]>("SELECT value FROM settings WHERE key = 'loyalty_initial_points'");
      const initialPoints = parseInt(initialPointsRow[0]?.value || '100');
      const multiplierRow = await dbQuery<{ value: string }[]>("SELECT value FROM settings WHERE key = 'loyalty_points_to_credit_multiplier'");
      const multiplier = parseFloat(multiplierRow[0]?.value || '2.0');
      const defaultLimit = initialPoints * multiplier;

      await dbQuery(`
        INSERT INTO user_credits (user_id, credit_limit, credit_used, loyalty_points, credit_status)
        VALUES (?, ?, 0.0, ?, 'active')
      `, [customerId, defaultLimit, initialPoints]);
      credit = { credit_limit: defaultLimit, credit_used: 0.0, loyalty_points: initialPoints, credit_status: 'active' };
    }

    if (payAmt > credit.credit_used) {
      return NextResponse.json({ error: `El abono ($${payAmt.toFixed(2)}) supera la deuda actual ($${credit.credit_used.toFixed(2)}).` }, { status: 400 });
    }

    // Calculate loyalty points reward
    const pointsPerDollarRow = await dbQuery<{ value: string }[]>("SELECT value FROM settings WHERE key = 'loyalty_points_per_dollar'");
    const pointsPerDollar = parseFloat(pointsPerDollarRow[0]?.value || '0.1');
    const pointsEarned = Math.floor(payAmt * pointsPerDollar) || 1;

    const multiplierRow = await dbQuery<{ value: string }[]>("SELECT value FROM settings WHERE key = 'loyalty_points_to_credit_multiplier'");
    const multiplier = parseFloat(multiplierRow[0]?.value || '2.0');

    const newDebt = credit.credit_used - payAmt;
    const newPoints = credit.loyalty_points + pointsEarned;
    const newLimit = newPoints * multiplier;

    // Update credit profile and history tables in batch
    await dbBatch([
      {
        sql: `
          UPDATE user_credits 
          SET credit_used = ?, loyalty_points = ?, credit_limit = ?
          WHERE user_id = ?
        `,
        params: [newDebt, newPoints, newLimit, customerId]
      },
      {
        sql: `
          INSERT INTO credit_history (user_id, amount_change, movement_type, reference_id, notes, cash_closure_id, payment_method)
          VALUES (?, ?, 'payment', ?, ?, ?, ?)
        `,
        params: [
          customerId, 
          -payAmt, 
          reference || 'Abono POS', 
          `Abono de deuda por $${payAmt.toFixed(2)} pagado mediante ${paymentMethod} en POS por vendedor ${session.fullName}`,
          activeClosure.id,
          paymentMethod
        ]
      },
      {
        sql: `
          INSERT INTO loyalty_history (user_id, points_change, reason, reference_id)
          VALUES (?, ?, 'Abono de deuda a crédito', 'Abono POS')
        `,
        params: [customerId, pointsEarned, 'Abono POS']
      }
    ]);

    const result = { newDebt: Number(newDebt.toFixed(2)), newPoints, newLimit: Number(newLimit.toFixed(2)) };
    return NextResponse.json({ success: true, result });

  } catch (error: any) {
    console.error('POS Credit Payment Error:', error);
    return NextResponse.json({ error: error.message || 'Error al procesar el abono de deuda.' }, { status: 400 });
  }
}
