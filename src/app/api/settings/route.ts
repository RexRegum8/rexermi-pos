export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

const PUBLIC_SETTINGS_KEYS = new Set([
  'site_name',
  'site_tagline',
  'contact_email',
  'contact_phone',
  'currency',
  'currency_symbol',
  'payment_zoom',
  'payment_bank',
  'payment_binance',
  'payment_other',
  'shipping_info',
  'min_order',
  'logo_text',
  'primary_color',
  'primary_color_light',
  'primary_color_dark',
  'glass_blur',
  'glass_opacity',
  'logo_url',
  'dark_mode_default',
  'text_color_dark',
  'text_color_light',
  'bg_color_dark',
  'bg_color_light',
  'accent_dark',
  'accent_light',
  'store_open',
  'store_status_mode',
  'store_schedule_start',
  'store_schedule_end',
  'store_schedule_days',
  'dollar_rate',
  'commission_rate'
]);

export async function GET(req: NextRequest) {
  try {
    const rows = await dbQuery<any[]>('SELECT `key`, `value` FROM settings');
    const settings: Record<string, string> = {};
    const isAdmin = !!(await verifyAdminToken(req));

    rows.forEach(r => {
      if (isAdmin || PUBLIC_SETTINGS_KEYS.has(r.key)) {
        settings[r.key] = r.value || '';
      }
    });

    return NextResponse.json(
      { success: true, settings },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
        }
      }
    );
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    return NextResponse.json({ error: 'Error al cargar configuraciones' }, { status: 500 });
  }
}
