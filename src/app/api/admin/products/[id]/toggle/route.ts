export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  const { id } = await params;
  const products = await dbQuery<{ is_active: number }[]>('SELECT is_active FROM products WHERE id = ?', [id]);
  if (!products.length) return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 404 });
  const newState = products[0].is_active ? 0 : 1;
  await dbQuery('UPDATE products SET is_active = ? WHERE id = ?', [newState, id]);
  return NextResponse.json({ success: true, message: newState ? 'Producto activado.' : 'Producto ocultado.' });
}
