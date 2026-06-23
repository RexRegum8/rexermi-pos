import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';
import { logAdminAction } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

export async function POST(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const { settings } = (await req.json()) as any;
    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
    }

    const updatedKeys: string[] = [];
    for (const [key, value] of Object.entries(settings)) {
      // Try updating first; if no row affected, insert a new one
      const result = await dbQuery<{ affectedRows: number }>(
        'UPDATE settings SET value = ? WHERE `key` = ?',
        [String(value), key]
      );
      if ((result as any).affectedRows === 0) {
        await dbQuery(
          'INSERT INTO settings (`key`, value, label, `group`) VALUES (?, ?, ?, ?)',
          [key, String(value), key, 'theme']
        );
      }
      updatedKeys.push(key);
    }

    await logAdminAction(
      admin,
      'Actualización de ajustes',
      `Ajustes generales/tema actualizados. Claves modificadas: ${updatedKeys.join(', ')}`
    );

    // Purge Layout & Page cache so theme styles reload instantly
    revalidatePath('/', 'layout');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings update error:', error);
    return NextResponse.json({ error: 'Error al guardar ajustes.' }, { status: 500 });
  }
}
