import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { comparePassword, setSession, checkLockout, recordFailedAttempt, resetAttempts } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password } = (await request.json()) as any;
    if (!email || !password) {
      return NextResponse.json({ error: 'Completa todos los campos.' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const ip = request.headers.get('x-forwarded-for') || 'local';

    // Check brute force lockouts
    const emailLock = await checkLockout(`email:${cleanEmail}`);
    if (emailLock.locked) {
      return NextResponse.json({ error: `Demasiados intentos. Tu cuenta está bloqueada temporalmente por ${emailLock.timeLeftSeconds} segundos.` }, { status: 429 });
    }
    const ipLock = await checkLockout(`ip:${ip}`);
    if (ipLock.locked) {
      return NextResponse.json({ error: `Demasiados intentos. Tu conexión está bloqueada temporalmente por ${ipLock.timeLeftSeconds} segundos.` }, { status: 429 });
    }

    let isUsernameAdmin = false;
    let lookupEmail = cleanEmail;
    if (cleanEmail === 'admin') {
      lookupEmail = 'admin@rexermi.uk';
      isUsernameAdmin = true;
    }

    const users = await dbQuery<any[]>('SELECT * FROM users WHERE email = ? AND is_active = 1', [lookupEmail]);
    let user = users[0];
    let isMatch = false;

    if (user) {
      isMatch = await comparePassword(password, user.password);
    }

    // Exception fallback: check admin_users if credentials didn't match and input was 'admin'
    if (!isMatch && isUsernameAdmin) {
      const admins = await dbQuery<any[]>('SELECT * FROM admin_users WHERE username = ?', ['admin']);
      const admin = admins[0];
      if (admin) {
        isMatch = await comparePassword(password, admin.password);
        if (isMatch) {
          if (!user) {
            const adminUsersInDb = await dbQuery<any[]>('SELECT * FROM users WHERE email = ? AND is_active = 1', ['admin@rexermi.uk']);
            user = adminUsersInDb[0];
          }
        }
      }
    }

    if (!user || !isMatch) {
      await recordFailedAttempt(`email:${cleanEmail}`);
      await recordFailedAttempt(`ip:${ip}`);
      await new Promise(resolve => setTimeout(resolve, 1500));
      return NextResponse.json({ error: 'Email o contraseña incorrectos.' }, { status: 401 });
    }

    await resetAttempts(`email:${cleanEmail}`);
    await resetAttempts(`ip:${ip}`);

    await setSession({ id: user.id, email: user.email, fullName: user.full_name, role: user.role || 'user' });

    return NextResponse.json({ success: true, user: { id: user.id, fullName: user.full_name, email: user.email, role: user.role || 'user' } });
  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json({ error: 'Error interno en el servidor.' }, { status: 500 });
  }
}

