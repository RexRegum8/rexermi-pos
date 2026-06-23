export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await verifyAdminToken(req);
    if (!session) {
      return NextResponse.json({ count: 0 });
    }

    const result = await dbQuery<{ count: number }[]>(
      "SELECT COUNT(*) as count FROM chat_messages WHERE sender_role = 'user' AND is_read = 0"
    );

    const count = result[0]?.count || 0;

    return NextResponse.json({ success: true, count });
  } catch (error: any) {
    console.error('Error fetching admin total unread chat count:', error);
    return NextResponse.json({ count: 0 });
  }
}
