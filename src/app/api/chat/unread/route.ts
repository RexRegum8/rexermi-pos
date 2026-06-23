import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyCustomerToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await verifyCustomerToken(req);
    if (!session) {
      return NextResponse.json({ count: 0 });
    }

    const userId = session.id;

    const result = await dbQuery<{ count: number }[]>(
      "SELECT COUNT(*) as count FROM chat_messages WHERE user_id = ? AND sender_role = 'admin' AND is_read = 0",
      [userId]
    );

    const count = result[0]?.count || 0;

    return NextResponse.json({ success: true, count });
  } catch (error: any) {
    console.error('Error fetching unread support chat count:', error);
    return NextResponse.json({ count: 0 });
  }
}
