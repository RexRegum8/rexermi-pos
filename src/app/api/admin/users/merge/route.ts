import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, dbBatch } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const body = (await request.json()) as any;
    const { primaryId, duplicateId, primaryUserId, duplicateUserId } = body;

    const pId = parseInt(primaryId || primaryUserId, 10);
    const dId = parseInt(duplicateId || duplicateUserId, 10);

    if (isNaN(pId) || isNaN(dId) || pId === dId) {
      return NextResponse.json({ error: 'IDs de usuario inválidos.' }, { status: 400 });
    }

    // 1. Fetch both users to verify existance and matching id_document
    const primaryRows = await dbQuery<any[]>('SELECT * FROM users WHERE id = ?', [pId]);
    const primary = primaryRows[0];
    const duplicateRows = await dbQuery<any[]>('SELECT * FROM users WHERE id = ?', [dId]);
    const duplicate = duplicateRows[0];

    if (!primary || !duplicate) {
      return NextResponse.json({ error: 'Uno o ambos usuarios no existen.' }, { status: 404 });
    }

    const pDoc = primary.id_document?.trim().toLowerCase();
    const dDoc = duplicate.id_document?.trim().toLowerCase();

    const pEmail = primary.email?.trim().toLowerCase();
    const dEmail = duplicate.email?.trim().toLowerCase();

    const pPhone = primary.phone?.trim();
    const dPhone = duplicate.phone?.trim();

    const matchesDoc = pDoc && dDoc && pDoc === dDoc;
    const matchesEmail = pEmail && dEmail && pEmail === dEmail;
    const matchesPhone = pPhone && dPhone && pPhone === dPhone;

    if (!matchesDoc && !matchesEmail && !matchesPhone) {
      return NextResponse.json({ error: 'Los usuarios no comparten ningún dato en común (Cédula, Correo o Teléfono) para unificar.' }, { status: 400 });
    }

    // 2. Determine merged fields
    const primaryEmailIsPlaceholder = primary.email.endsWith('@pos.local');
    const duplicateEmailIsPlaceholder = duplicate.email.endsWith('@pos.local');

    let finalEmail = primary.email;
    let finalPassword = primary.password;
    let finalIsActive = primary.is_active;

    // Smart email merger: if primary has placeholder email but duplicate has real email, preserve the real email (and web credentials)
    if (primaryEmailIsPlaceholder && !duplicateEmailIsPlaceholder) {
      finalEmail = duplicate.email;
      finalPassword = duplicate.password;
      finalIsActive = duplicate.is_active;
    }

    const finalFields = {
      full_name: primary.full_name || duplicate.full_name,
      email: finalEmail,
      password: finalPassword,
      phone: primary.phone || duplicate.phone,
      address: primary.address || duplicate.address,
      city: primary.city || duplicate.city,
      state: primary.state || duplicate.state,
      postal_code: primary.postal_code || duplicate.postal_code,
      notes: (primary.notes || '') + (duplicate.notes ? '\n' + duplicate.notes : ''),
      is_active: finalIsActive
    };

    // 3. Execute atomic batch
    await dbBatch([
      { sql: 'UPDATE orders SET user_id = ? WHERE user_id = ?', params: [pId, dId] },
      { sql: 'UPDATE chat_messages SET user_id = ? WHERE user_id = ?', params: [pId, dId] },
      { sql: 'UPDATE product_reviews SET user_id = ? WHERE user_id = ?', params: [pId, dId] },
      { sql: 'DELETE FROM users WHERE id = ?', params: [dId] },
      {
        sql: `UPDATE users 
              SET full_name = ?, email = ?, password = ?, phone = ?, address = ?, city = ?, state = ?, postal_code = ?, notes = ?, is_active = ?
              WHERE id = ?`,
        params: [
          finalFields.full_name,
          finalFields.email,
          finalFields.password,
          finalFields.phone || null,
          finalFields.address || null,
          finalFields.city || null,
          finalFields.state || null,
          finalFields.postal_code || null,
          finalFields.notes || null,
          finalFields.is_active,
          pId
        ]
      }
    ]);

    return NextResponse.json({ success: true, message: 'Usuarios fusionados correctamente.' });
  } catch (error: any) {
    console.error('Merge Users API Error:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}
