import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyCustomerToken } from '@/lib/auth';
import { getSettings, isCreditAvailable } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await verifyCustomerToken(req);
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const settings = await getSettings();
    const isAvailable = isCreditAvailable(settings);

    // Initial config for fallbacks
    const initialPoints = parseInt(settings['loyalty_initial_points'] || '100');
    const multiplier = parseFloat(settings['loyalty_points_to_credit_multiplier'] || '2.0');
    const defaultLimit = initialPoints * multiplier;

    // Check if user has a row
    const creditRows = await dbQuery<{ credit_limit: number; credit_used: number; loyalty_points: number; credit_status: string }[]>(
      'SELECT credit_limit, credit_used, loyalty_points, credit_status FROM user_credits WHERE user_id = ?',
      [user.id]
    );

    let creditInfo;
    if (creditRows.length === 0) {
      // Create it lazily
      await dbQuery(
        'INSERT OR IGNORE INTO user_credits (user_id, credit_limit, credit_used, loyalty_points, credit_status) VALUES (?, ?, 0.0, ?, \'active\')',
        [user.id, defaultLimit, initialPoints]
      );
      creditInfo = {
        credit_limit: defaultLimit,
        credit_used: 0.0,
        loyalty_points: initialPoints,
        credit_status: 'active'
      };
    } else {
      creditInfo = creditRows[0];
    }

    return NextResponse.json({
      success: true,
      isAvailable,
      creditEnabled: settings['credit_enabled'] === '1',
      creditMode: settings['credit_mode'] || 'free',
      creditLimit: creditInfo.credit_limit,
      creditUsed: creditInfo.credit_used,
      loyaltyPoints: creditInfo.loyalty_points,
      creditStatus: creditInfo.credit_status,
      availableBalance: Math.max(0, creditInfo.credit_limit - creditInfo.credit_used),
      minPointsRequired: parseInt(settings['loyalty_min_points_for_credit'] || '50')
    });
  } catch (error) {
    console.error('Error fetching customer credit:', error);
    return NextResponse.json({ error: 'Error interno al consultar el crédito.' }, { status: 500 });
  }
}
