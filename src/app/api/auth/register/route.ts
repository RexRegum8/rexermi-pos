export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { hashPassword, setSession, checkLockout, recordFailedAttempt } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'local';
    
    // Check registration rate limit
    const registerLock = await checkLockout(`register:${ip}`);
    if (registerLock.locked) {
      return NextResponse.json({ error: `Demasiados registros. Tu conexión está bloqueada temporalmente por ${registerLock.timeLeftSeconds} segundos.` }, { status: 429 });
    }

    await recordFailedAttempt(`register:${ip}`);

    const body = (await request.json()) as any;
    const { full_name, email, password, phone, id_document, address, city, state } = body;

    if (!full_name || !email || !password) {
      return NextResponse.json({ error: 'Nombre, email y contraseña son requeridos.' }, { status: 400 });
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres, incluyendo letras y números.' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await dbQuery<any[]>('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Ya existe una cuenta con ese correo electrónico.' }, { status: 409 });
    }

    if (id_document && id_document.trim() !== '') {
      const cleanDoc = id_document.trim();
      const existingDoc = await dbQuery<any[]>('SELECT id FROM users WHERE LOWER(TRIM(id_document)) = LOWER(TRIM(?))', [cleanDoc]);
      if (existingDoc.length > 0) {
        return NextResponse.json({ error: 'Ya existe una cuenta registrada con esta Cédula / RIF.' }, { status: 409 });
      }
    }

    if (phone && phone.trim() !== '' && phone.trim() !== '—') {
      const cleanPhone = phone.trim();
      const existingPhone = await dbQuery<any[]>('SELECT id FROM users WHERE TRIM(phone) = TRIM(?)', [cleanPhone]);
      if (existingPhone.length > 0) {
        return NextResponse.json({ error: 'Ya existe una cuenta registrada con este número de teléfono.' }, { status: 409 });
      }
    }

    const hashedPassword = await hashPassword(password);
    const result = await dbQuery<any>(
      'INSERT INTO users (full_name, email, password, phone, id_document, address, city, state, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
      [full_name.trim(), cleanEmail, hashedPassword, phone || null, id_document || null, address || null, city || null, state || null]
    );

    const userId = result.insertId;
    await setSession({ id: userId, email: cleanEmail, fullName: full_name.trim(), role: 'user' });

    return NextResponse.json({ success: true, user: { id: userId, fullName: full_name.trim(), email: cleanEmail } });
  } catch (error) {
    console.error('Register API error:', error);
    return NextResponse.json({ error: 'Error interno en el servidor.' }, { status: 500 });
  }
}
