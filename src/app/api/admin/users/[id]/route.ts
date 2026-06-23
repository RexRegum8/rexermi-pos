import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, dbBatch } from '@/lib/db';
import { hashPassword, verifyAdminToken } from '@/lib/auth';
import { logAdminAction } from '@/lib/audit';

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }
    const { id } = await context.params;
    const userId = parseInt(id, 10);
    const body = (await request.json()) as any;
    const { full_name, email, phone, city, role, password, is_active, id_document } = body;

    if (!full_name || !email) {
      return NextResponse.json({ error: 'Nombre y email son obligatorios.' }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'El formato de correo electrónico es inválido.' }, { status: 400 });
    }

    if (password && password.trim() !== '' && password.length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 });
    }

    const rolesWhitelist = ['user', 'vendedor', 'admin', 'custom'];
    const cleanRole = (role || 'user').toLowerCase().trim();
    if (!rolesWhitelist.includes(cleanRole)) {
      return NextResponse.json({ error: 'Rol no admitido o inválido.' }, { status: 400 });
    }

    // Check if email exists for other users
    const existing = await dbQuery<any[]>('SELECT id FROM users WHERE email = ? AND id != ?', [email.toLowerCase().trim(), userId]);
    if (existing.length > 0) {
      return NextResponse.json({ error: 'El correo ya está en uso por otro usuario.' }, { status: 400 });
    }

    if (id_document && id_document.trim() !== '') {
      const cleanDoc = id_document.trim();
      const existingDoc = await dbQuery<any[]>('SELECT id FROM users WHERE LOWER(TRIM(id_document)) = LOWER(TRIM(?)) AND id != ?', [cleanDoc, userId]);
      if (existingDoc.length > 0) {
        return NextResponse.json({ error: 'La Cédula / RIF ya está registrada por otro usuario.' }, { status: 400 });
      }
    }

    if (phone && phone.trim() !== '' && phone.trim() !== '—') {
      const cleanPhone = phone.trim();
      const existingPhone = await dbQuery<any[]>('SELECT id FROM users WHERE TRIM(phone) = TRIM(?) AND id != ?', [cleanPhone, userId]);
      if (existingPhone.length > 0) {
        return NextResponse.json({ error: 'El número de teléfono ya está en uso por otro usuario.' }, { status: 400 });
      }
    }

    const finalPermissions = body.permissions ? (typeof body.permissions === 'string' ? body.permissions : JSON.stringify(body.permissions)) : null;

    if (password && password.trim() !== '') {
      const hashedPwd = await hashPassword(password);
      await dbQuery(
        'UPDATE users SET full_name = ?, email = ?, password = ?, phone = ?, city = ?, role = ?, is_active = ?, id_document = ?, permissions = ? WHERE id = ?',
        [full_name, email.toLowerCase().trim(), hashedPwd, phone || null, city || null, cleanRole, is_active !== undefined ? is_active : 1, id_document || null, finalPermissions, userId]
      );
    } else {
      await dbQuery(
        'UPDATE users SET full_name = ?, email = ?, phone = ?, city = ?, role = ?, is_active = ?, id_document = ?, permissions = ? WHERE id = ?',
        [full_name, email.toLowerCase().trim(), phone || null, city || null, cleanRole, is_active !== undefined ? is_active : 1, id_document || null, finalPermissions, userId]
      );
    }

    await logAdminAction(
      admin,
      'Modificación de usuario',
      `Actualizado usuario con ID ${userId} (Email: ${email.toLowerCase().trim()}, Rol: ${cleanRole}, Activo: ${is_active !== undefined ? is_active : 1})`
    );

    return NextResponse.json({ success: true, message: 'Usuario actualizado exitosamente.' });
  } catch (error) {
    console.error('Update User API Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }
    const { id } = await context.params;
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'ID de usuario inválido.' }, { status: 400 });
    }

    // Run clean delete batch to unlink/remove dependencies and delete user
    await dbBatch([
      { sql: 'UPDATE orders SET cash_closure_id = NULL WHERE cash_closure_id IN (SELECT id FROM cash_closures WHERE user_id = ?)', params: [userId] },
      { sql: 'UPDATE orders SET user_id = NULL WHERE user_id = ?', params: [userId] },
      { sql: 'DELETE FROM cash_closures WHERE user_id = ?', params: [userId] },
      { sql: 'DELETE FROM chat_messages WHERE user_id = ?', params: [userId] },
      { sql: 'DELETE FROM product_reviews WHERE user_id = ?', params: [userId] },
      { sql: 'DELETE FROM users WHERE id = ?', params: [userId] }
    ]);

    await logAdminAction(
      admin,
      'Eliminación de usuario',
      `Eliminado usuario con ID ${userId} de forma segura.`
    );

    return NextResponse.json({ success: true, message: 'Usuario eliminado correctamente junto con su actividad de forma segura.' });
  } catch (error: any) {
    console.error('Delete User API Error:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}
