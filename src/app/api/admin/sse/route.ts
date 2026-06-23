export const runtime = 'edge';
import { NextRequest } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) {
    return new Response('No autorizado', { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Stream already closed
        }
      };

      const fetchAndSend = async () => {
        try {
          // Unread chat messages count
          const unreadResult = await dbQuery<{ count: number }[]>(
            "SELECT COUNT(*) as count FROM chat_messages WHERE sender_role = 'user' AND is_read = 0"
          );
          send('unread', { count: unreadResult[0]?.count ?? 0 });

          // Pending orders count  
          const pendingResult = await dbQuery<{ count: number }[]>(
            "SELECT COUNT(*) as count FROM orders WHERE status = 'pending'"
          );
          send('pending_orders', { count: pendingResult[0]?.count ?? 0 });

          // Out of stock products count
          const outOfStockResult = await dbQuery<{ count: number }[]>(
            "SELECT COUNT(*) as count FROM products WHERE stock = 0 AND type = 'product' AND is_active = 1"
          );
          send('out_of_stock', { count: outOfStockResult[0]?.count ?? 0 });
        } catch (err) {
          console.error('[SSE] Error fetching data:', err);
        }
      };

      // Send initial data immediately
      fetchAndSend();

      // Then every 30 seconds
      const interval = setInterval(fetchAndSend, 30000);

      // Send heartbeat every 20s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
          clearInterval(interval);
        }
      }, 20000);

      // Cleanup when client disconnects
      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        clearInterval(heartbeat);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
