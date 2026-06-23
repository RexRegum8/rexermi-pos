import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const { code, discount_type, discount_value, min_order, uses_left, expires_at, is_active } = (await req.json()) as any;
    if (!code || !discount_value) return NextResponse.json({ error: 'Código y valor son requeridos.' }, { status: 400 });

    await dbQuery(
      'INSERT INTO coupons (code, discount_type, discount_value, min_order, uses_left, expires_at, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [code.toUpperCase(), discount_type || 'percent', discount_value, min_order || 0, uses_left || null, expires_at || null, is_active ? 1 : 0]
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') return NextResponse.json({ error: 'Ya existe un cupón con ese código.' }, { status: 409 });
    return NextResponse.json({ error: 'Error al crear cupón.' }, { status: 500 });
  }
}
