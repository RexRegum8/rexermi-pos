export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { hashPassword, verifyAdminToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }
    const body = (await request.json()) as any;
    const { full_name, email, phone, city, role, password, is_active, id_document } = body;

    if (!full_name || !email || !password) {
      return NextResponse.json({ error: 'Nombre, email y contraseña son obligatorios.' }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'El formato de correo electrónico es inválido.' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 });
    }

    const rolesWhitelist = ['user', 'vendedor', 'admin', 'custom'];
    const cleanRole = (role || 'user').toLowerCase().trim();
    if (!rolesWhitelist.includes(cleanRole)) {
      return NextResponse.json({ error: 'Rol no admitido o inválido.' }, { status: 400 });
    }

    // Check if email exists
    const existing = await dbQuery<any[]>('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing.length > 0) {
      return NextResponse.json({ error: 'El correo ya está registrado.' }, { status: 400 });
    }

    if (id_document && id_document.trim() !== '') {
      const cleanDoc = id_document.trim();
      const existingDoc = await dbQuery<any[]>('SELECT id FROM users WHERE LOWER(TRIM(id_document)) = LOWER(TRIM(?))', [cleanDoc]);
      if (existingDoc.length > 0) {
        return NextResponse.json({ error: 'La Cédula / RIF ya está registrada por otro usuario.' }, { status: 400 });
      }
    }

    if (phone && phone.trim() !== '' && phone.trim() !== '—') {
      const cleanPhone = phone.trim();
      const existingPhone = await dbQuery<any[]>('SELECT id FROM users WHERE TRIM(phone) = TRIM(?)', [cleanPhone]);
      if (existingPhone.length > 0) {
        return NextResponse.json({ error: 'El número de teléfono ya está registrado por otro usuario.' }, { status: 400 });
      }
    }

    const hashedPwd = await hashPassword(password);
    const finalPermissions = body.permissions ? (typeof body.permissions === 'string' ? body.permissions : JSON.stringify(body.permissions)) : null;

    await dbQuery(
      'INSERT INTO users (full_name, email, password, phone, city, role, is_active, id_document, permissions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [full_name, email.toLowerCase().trim(), hashedPwd, phone || null, city || null, cleanRole, is_active !== undefined ? is_active : 1, id_document || null, finalPermissions]
    );

    return NextResponse.json({ success: true, message: 'Usuario creado exitosamente.' });
  } catch (error) {
    console.error('Create User API Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
