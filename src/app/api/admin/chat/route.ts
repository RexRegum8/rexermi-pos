import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await verifyAdminToken(req);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const threads = await dbQuery<any[]>(`
      SELECT u.id, u.full_name, u.email,
             (SELECT COUNT(*) FROM chat_messages WHERE user_id = u.id AND sender_role = 'user' AND is_read = 0) as unread_count,
             (SELECT message FROM chat_messages WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as last_message,
             (SELECT created_at FROM chat_messages WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as last_message_time
      FROM users u
      WHERE EXISTS (SELECT 1 FROM chat_messages WHERE user_id = u.id)
      ORDER BY last_message_time DESC
    `);

    return NextResponse.json({ success: true, threads });
  } catch (error: any) {
    console.error('Error fetching admin chat threads:', error);
    return NextResponse.json({ error: 'Error al cargar hilos de chat' }, { status: 500 });
  }
}
