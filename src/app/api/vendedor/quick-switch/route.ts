import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { getPOSSession, setSession, comparePassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { action, pin, password } = (await req.json()) as any;

    if (action === 'switch') {
      if (!pin || typeof pin !== 'string' || pin.trim() === '') {
        return NextResponse.json({ error: 'El PIN es obligatorio.' }, { status: 400 });
      }

      // Find active user with this PIN
      const usersRows = await dbQuery<any[]>(`
        SELECT id, email, full_name, role, permissions 
        FROM users 
        WHERE pin = ? AND is_active = 1
      `, [pin.trim()]);
      const user = usersRows[0];

      if (!user) {
        return NextResponse.json({ error: 'PIN incorrecto o usuario inactivo.' }, { status: 401 });
      }

      // Check if user has permission to access POS
      let hasPOSAccess = user.role === 'vendedor' || user.role === 'admin';
      if (user.role === 'custom' && user.permissions) {
        try {
          const perms = JSON.parse(user.permissions);
          if (perms.pos_access) hasPOSAccess = true;
        } catch {
          // ignore
        }
      }

      if (!hasPOSAccess) {
        return NextResponse.json({ error: 'El usuario no tiene acceso al Punto de Venta (POS).' }, { status: 403 });
      }

      // Log in the new cashier
      await setSession({
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role
      });

      // Check active cash closure for this cashier
      const activeClosures = await dbQuery<any[]>(`
        SELECT id, opening_amount, expected_amount, notes, status, opened_at 
        FROM cash_closures 
        WHERE user_id = ? AND status = 'open'
      `, [user.id]);
      const activeClosure = activeClosures[0];

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          role: user.role
        },
        activeClosure: activeClosure || null
      });

    } else if (action === 'set_pin') {
      const currentSession = await getPOSSession();
      if (!currentSession) {
        return NextResponse.json({ error: 'Sesión no iniciada.' }, { status: 401 });
      }

      if (!password || !pin) {
        return NextResponse.json({ error: 'Contraseña y PIN son obligatorios.' }, { status: 400 });
      }

      if (typeof pin !== 'string' || pin.length !== 4 || isNaN(Number(pin))) {
        return NextResponse.json({ error: 'El PIN debe ser un código numérico de 4 dígitos.' }, { status: 400 });
      }

      // Verify current password
      const usersRows = await dbQuery<any[]>('SELECT password FROM users WHERE id = ?', [currentSession.id]);
      const user = usersRows[0];
      if (!user) {
        return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
      }

      const isMatch = await comparePassword(password, user.password);
      if (!isMatch) {
        return NextResponse.json({ error: 'Contraseña incorrecta.' }, { status: 401 });
      }

      // Check if PIN is already used by another user
      const duplicateUsers = await dbQuery<any[]>('SELECT id FROM users WHERE pin = ? AND id != ?', [pin, currentSession.id]);
      const duplicateUser = duplicateUsers[0];
      if (duplicateUser) {
        return NextResponse.json({ error: 'Este PIN ya está en uso por otro cajero. Elige otro.' }, { status: 400 });
      }

      // Update PIN
      await dbQuery('UPDATE users SET pin = ? WHERE id = ?', [pin, currentSession.id]);

      return NextResponse.json({ success: true, message: 'PIN de cajero configurado exitosamente.' });

    } else {
      return NextResponse.json({ error: 'Acción no permitida.' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('API Quick Switch Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
