export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  const { id } = await params;
  
  const body = (await req.json().catch(() => ({}))) as any;
  const action = body.action || 'toggle_active';

  const users = await dbQuery<{ is_active: number, role: string }[]>('SELECT is_active, role FROM users WHERE id = ?', [id]);
  if (!users.length) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });

  if (action === 'toggle_role') {
    const newRole = body.newRole === 'vendedor' ? 'vendedor' : 'user';
    await dbQuery('UPDATE users SET role = ? WHERE id = ?', [newRole, id]);
    return NextResponse.json({ success: true, message: 'Rol actualizado.' });
  } else {
    const newState = users[0].is_active ? 0 : 1;
    await dbQuery('UPDATE users SET is_active = ? WHERE id = ?', [newState, id]);
    return NextResponse.json({ success: true, message: newState ? 'Usuario habilitado.' : 'Usuario deshabilitado.' });
  }
}
