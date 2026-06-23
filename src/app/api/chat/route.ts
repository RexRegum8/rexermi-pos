import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyCustomerToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';

export async function GET(req: NextRequest) {
  try {
    const session = await verifyCustomerToken(req);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userId = session.id;

    // Fetch messages
    const messages = await dbQuery<any[]>(
      'SELECT id, user_id, sender_role, message, is_read, created_at FROM chat_messages WHERE user_id = ? ORDER BY created_at ASC',
      [userId]
    );

    // Mark admin replies as read
    await dbQuery(
      "UPDATE chat_messages SET is_read = 1 WHERE user_id = ? AND sender_role = 'admin' AND is_read = 0",
      [userId]
    );

    return NextResponse.json({ success: true, messages });
  } catch (error: any) {
    console.error('Error fetching chat messages:', error);
    return NextResponse.json({ error: 'Error al cargar mensajes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const limitResult = await checkRateLimit(`ip:${ip}:chat`, 15, 60000); // 15 per minute
    if (!limitResult.success) {
      return NextResponse.json(
        { error: 'Has enviado demasiados mensajes. Intenta de nuevo más tarde.' },
        { status: 429 }
      );
    }

    const session = await verifyCustomerToken(req);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userId = session.id;
    const { message } = (await req.json()) as any;

    if (!message || message.trim() === '') {
      return NextResponse.json({ error: 'El mensaje no puede estar vacío' }, { status: 400 });
    }

    const result = await dbQuery(
      "INSERT INTO chat_messages (user_id, sender_role, message, is_read) VALUES (?, 'user', ?, 0)",
      [userId, message.trim()]
    );

    const newMessage = {
      id: result.insertId,
      user_id: userId,
      sender_role: 'user',
      message: message.trim(),
      is_read: 0,
      created_at: new Date().toISOString()
    };

    return NextResponse.json({ success: true, message: newMessage });
  } catch (error: any) {
    console.error('Error sending chat message:', error);
    return NextResponse.json({ error: 'Error al enviar mensaje' }, { status: 500 });
  }
}
