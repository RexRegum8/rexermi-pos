export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

const ALLOWED_CONFIGS = [
  'credit_enabled',
  'credit_mode',
  'credit_schedule_mode',
  'credit_schedule_start',
  'credit_schedule_end',
  'credit_schedule_days',
  'credit_season_start',
  'credit_season_end',
  'loyalty_points_per_dollar',
  'loyalty_points_to_credit_multiplier',
  'loyalty_min_points_for_credit',
  'loyalty_initial_points',
];

const DEFAULT_CONFIGS: Record<string, string> = {
  credit_enabled: '0',
  credit_mode: 'free',
  credit_schedule_mode: 'always',
  credit_schedule_start: '08:00',
  credit_schedule_end: '18:00',
  credit_schedule_days: '1,2,3,4,5',
  credit_season_start: '',
  credit_season_end: '',
  loyalty_points_per_dollar: '0.1',
  loyalty_points_to_credit_multiplier: '2.0',
  loyalty_min_points_for_credit: '50',
  loyalty_initial_points: '100',
};

export async function GET(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const rows = await dbQuery<{ key: string; value: string }[]>(
      "SELECT `key`, value FROM settings WHERE `key` IN (" + ALLOWED_CONFIGS.map(() => '?').join(',') + ")",
      ALLOWED_CONFIGS
    );

    const config: Record<string, string> = { ...DEFAULT_CONFIGS };
    rows.forEach(r => {
      config[r.key] = r.value || '';
    });

    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('Failed to get credit config:', error);
    return NextResponse.json({ error: 'Error al obtener la configuración de crédito.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const { config } = (await req.json()) as any;
    if (!config || typeof config !== 'object') {
      return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
    }

    for (const [key, value] of Object.entries(config)) {
      if (!ALLOWED_CONFIGS.includes(key)) continue;

      const result = await dbQuery<{ affectedRows: number }>(
        'UPDATE settings SET value = ? WHERE `key` = ?',
        [String(value), key]
      );
      if ((result as any).affectedRows === 0) {
        await dbQuery(
          'INSERT INTO settings (`key`, value, label, `group`) VALUES (?, ?, ?, ?)',
          [key, String(value), key, 'credit']
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save credit config:', error);
    return NextResponse.json({ error: 'Error al guardar la configuración de crédito.' }, { status: 500 });
  }
}
