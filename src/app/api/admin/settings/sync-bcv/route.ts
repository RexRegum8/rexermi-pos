import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';
import { logAdminAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const apiRes = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });

    if (!apiRes.ok) {
      return NextResponse.json({ error: 'Error al consultar la tasa del BCV en DolarApi.' }, { status: 502 });
    }

    const data = (await apiRes.json()) as any;
    // dolarapi.com sometimes publishes only 'promedio' when BCV doesn't publish buy/sell separately
    const rawRate = data.venta ?? data.promedio ?? data.compra;
    const rate = parseFloat(rawRate);

    if (isNaN(rate) || rate <= 0) {
      return NextResponse.json({ error: 'Respuesta inválida de la API cambiaria (sin tasa disponible).' }, { status: 502 });
    }

    // Get old rate to log it
    const oldRates = await dbQuery<{ value: string }[]>("SELECT value FROM settings WHERE `key` = 'dollar_rate'");
    const oldRate = oldRates[0]?.value || 'desconocida';

    // Update settings table
    const result = await dbQuery<{ affectedRows: number }>(
      'UPDATE settings SET value = ? WHERE `key` = ?',
      [String(rate), 'dollar_rate']
    );

    if ((result as any).affectedRows === 0) {
      await dbQuery(
        "INSERT INTO settings (`key`, value, label, `group`) VALUES (?, ?, ?, ?)",
        ['dollar_rate', String(rate), 'Tasa de cambio (Bs. / USD)', 'general']
      );
    }

    // Log admin action
    await logAdminAction(
      admin,
      'Sincronización cambiaria',
      `Sincronización de tasa de cambio oficial BCV. Tasa anterior: ${oldRate} Bs. Tasa nueva: ${rate} Bs.`
    );

    return NextResponse.json({ success: true, rate });
  } catch (error) {
    console.error('BCV sync error:', error);
    return NextResponse.json({ error: 'Error interno al sincronizar tasa de cambio.' }, { status: 500 });
  }
}
