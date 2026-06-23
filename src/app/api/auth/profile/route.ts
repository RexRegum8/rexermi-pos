export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyCustomerToken, hashPassword, setCustomerToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await verifyCustomerToken(req);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const users = await dbQuery<any[]>(
      'SELECT id, full_name, email, phone, id_document, address, city, state, country, postal_code FROM users WHERE id = ?',
      [session.id]
    );

    if (users.length === 0) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user: users[0] });
  } catch (error: any) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Error al cargar el perfil' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await verifyCustomerToken(req);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = (await req.json()) as any;
    const { full_name, email, phone, id_document, address, city, state, country, postal_code, password } = body;

    if (!full_name || !email) {
      return NextResponse.json({ error: 'El nombre y correo son obligatorios' }, { status: 400 });
    }

    // Check if email already taken by someone else
    const existing = await dbQuery<any[]>(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email.trim().toLowerCase(), session.id]
    );
    if (existing.length > 0) {
      return NextResponse.json({ error: 'El correo electrónico ya está registrado por otro usuario' }, { status: 400 });
    }

    if (password && password.trim().length > 0) {
      if (password.trim().length < 6) {
        return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
      }
      const hashedPassword = await hashPassword(password.trim());
      await dbQuery(
        `UPDATE users 
         SET full_name = ?, email = ?, phone = ?, id_document = ?, address = ?, city = ?, state = ?, country = ?, postal_code = ?, password = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [
          full_name.trim(),
          email.trim().toLowerCase(),
          phone?.trim() || null,
          id_document?.trim() || null,
          address?.trim() || null,
          city?.trim() || null,
          state?.trim() || null,
          country?.trim() || 'Venezuela',
          postal_code?.trim() || null,
          hashedPassword,
          session.id
        ]
      );
    } else {
      await dbQuery(
        `UPDATE users 
         SET full_name = ?, email = ?, phone = ?, id_document = ?, address = ?, city = ?, state = ?, country = ?, postal_code = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [
          full_name.trim(),
          email.trim().toLowerCase(),
          phone?.trim() || null,
          id_document?.trim() || null,
          address?.trim() || null,
          city?.trim() || null,
          state?.trim() || null,
          country?.trim() || 'Venezuela',
          postal_code?.trim() || null,
          session.id
        ]
      );
    }

    // Update active cookie session so frontend instantly shows updated name and email
    const updatedSession = {
      id: session.id,
      email: email.trim().toLowerCase(),
      fullName: full_name.trim(),
      role: session.role
    };

    const response = NextResponse.json({ success: true, message: 'Perfil actualizado correctamente' });
    await setCustomerToken(response, updatedSession);

    return response;
  } catch (error: any) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Error al actualizar el perfil' }, { status: 500 });
  }
}
