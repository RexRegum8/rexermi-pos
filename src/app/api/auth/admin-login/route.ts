import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyAdminToken, setAdminToken, checkLockout, recordFailedAttempt, resetAttempts, createToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = (await req.json()) as any;

    if (!username || !password) {
      return NextResponse.json({ error: 'Usuario y contraseña requeridos.' }, { status: 400 });
    }

    const cleanUsername = username.toLowerCase().trim();
    const ip = req.headers.get('x-forwarded-for') || 'local';

    // Check brute force lockouts
    const userLock = await checkLockout(`admin:${cleanUsername}`);
    if (userLock.locked) {
      return NextResponse.json({ error: `Demasiados intentos. Tu cuenta está bloqueada temporalmente por ${userLock.timeLeftSeconds} segundos.` }, { status: 429 });
    }
    const ipLock = await checkLockout(`ip:${ip}`);
    if (ipLock.locked) {
      return NextResponse.json({ error: `Demasiados intentos. Tu conexión está bloqueada temporalmente por ${ipLock.timeLeftSeconds} segundos.` }, { status: 429 });
    }

    const admins = await dbQuery<{ id: number; username: string; password: string; full_name: string; role: string }[]>(
      'SELECT id, username, password, full_name, role FROM admin_users WHERE username = ?',
      [cleanUsername]
    );

    let admin = admins[0];
    let isUserTable = false;

    if (!admin) {
      const users = await dbQuery<{ id: number; email: string; password: string; full_name: string; role: string; permissions: string; is_active: number }[]>(
        'SELECT id, email, password, full_name, role, permissions, is_active FROM users WHERE email = ?',
        [cleanUsername]
      );
      const user = users[0];
      if (user && user.is_active === 1) {
        let hasAccess = false;
        if (user.role === 'admin') {
          hasAccess = true;
        } else if (user.role === 'custom') {
          try {
            const perms = JSON.parse(user.permissions || '{}');
            if (perms.admin_access) {
              hasAccess = true;
            }
          } catch {}
        }
        if (hasAccess) {
          admin = {
            id: user.id,
            username: user.email,
            password: user.password,
            full_name: user.full_name,
            role: user.role
          };
          isUserTable = true;
        }
      }
    }

    if (!admin) {
      await recordFailedAttempt(`admin:${cleanUsername}`);
      await recordFailedAttempt(`ip:${ip}`);
      await new Promise(resolve => setTimeout(resolve, 1500));
      return NextResponse.json({ error: 'Credenciales incorrectas.' }, { status: 401 });
    }

    const pwdToCheck = admin.password.replace(/^\$2y\$/, '$2a$').replace(/^\$2b\$/, '$2a$');
    const isValid = await bcrypt.compare(password, pwdToCheck);

    if (!isValid) {
      await recordFailedAttempt(`admin:${cleanUsername}`);
      await recordFailedAttempt(`ip:${ip}`);
      await new Promise(resolve => setTimeout(resolve, 1500));
      return NextResponse.json({ error: 'Credenciales incorrectas.' }, { status: 401 });
    }

    await resetAttempts(`admin:${cleanUsername}`);
    await resetAttempts(`ip:${ip}`);

    const token = await createToken({ id: admin.id, username: admin.username, role: admin.role || 'admin', isUserTable });
    const response = NextResponse.json({
      success: true,
      token,
      admin: { id: admin.id, username: admin.username, full_name: admin.full_name, role: admin.role || 'admin' }
    });
    await setAdminToken(response, { id: admin.id, username: admin.username, role: admin.role || 'admin', isUserTable } as any);

    return response;
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

