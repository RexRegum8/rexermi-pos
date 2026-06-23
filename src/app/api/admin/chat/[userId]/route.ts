export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ userId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await verifyAdminToken(req);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { userId } = await params;
    const customerId = parseInt(userId);

    if (isNaN(customerId)) {
      return NextResponse.json({ error: 'ID de usuario inválido' }, { status: 400 });
    }

    // Fetch customer details to show in chat header
    const customerResult = await dbQuery<any[]>(
      'SELECT id, full_name, email, phone, city FROM users WHERE id = ?',
      [customerId]
    );
    const customer = customerResult[0];
    if (!customer) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Fetch messages
    const messages = await dbQuery<any[]>(
      'SELECT id, user_id, sender_role, message, is_read, created_at FROM chat_messages WHERE user_id = ? ORDER BY created_at ASC',
      [customerId]
    );

    // Mark customer messages as read
    await dbQuery(
      "UPDATE chat_messages SET is_read = 1 WHERE user_id = ? AND sender_role = 'user' AND is_read = 0",
      [customerId]
    );

    return NextResponse.json({ success: true, customer, messages });
  } catch (error: any) {
    console.error('Error fetching admin chat history:', error);
    return NextResponse.json({ error: 'Error al cargar historial' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await verifyAdminToken(req);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { userId } = await params;
    const customerId = parseInt(userId);

    if (isNaN(customerId)) {
      return NextResponse.json({ error: 'ID de usuario inválido' }, { status: 400 });
    }

    const { message } = (await req.json()) as any;

    if (!message || message.trim() === '') {
      return NextResponse.json({ error: 'El mensaje no puede estar vacío' }, { status: 400 });
    }

    // Verify customer exists
    const customerResult = await dbQuery<any[]>('SELECT id FROM users WHERE id = ?', [customerId]);
    if (customerResult.length === 0) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const result = await dbQuery(
      "INSERT INTO chat_messages (user_id, sender_role, message, is_read) VALUES (?, 'admin', ?, 0)",
      [customerId, message.trim()]
    );

    const newMessage = {
      id: result.insertId,
      user_id: customerId,
      sender_role: 'admin',
      message: message.trim(),
      is_read: 0,
      created_at: new Date().toISOString()
    };

    return NextResponse.json({ success: true, message: newMessage });
  } catch (error: any) {
    console.error('Error sending admin reply:', error);
    return NextResponse.json({ error: 'Error al enviar respuesta' }, { status: 500 });
  }
}
