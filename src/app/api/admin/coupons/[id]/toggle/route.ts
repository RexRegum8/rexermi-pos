export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  const { id } = await params;
  const coupons = await dbQuery<{ is_active: number }[]>('SELECT is_active FROM coupons WHERE id = ?', [id]);
  if (!coupons.length) return NextResponse.json({ error: 'Cupón no encontrado.' }, { status: 404 });
  const newState = coupons[0].is_active ? 0 : 1;
  await dbQuery('UPDATE coupons SET is_active = ? WHERE id = ?', [newState, id]);
  return NextResponse.json({ success: true, message: newState ? 'Cupón activado.' : 'Cupón desactivado.' });
}
