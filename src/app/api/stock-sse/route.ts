import { NextRequest } from 'next/server';
import { stockEmitter } from '@/lib/stockEmitter';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const listener = (data: { productId: number; stock: number }) => {
        try {
          controller.enqueue(
            encoder.encode(`event: stock_update\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Closed stream
        }
      };

      stockEmitter.on('update', listener);

      // Heartbeat every 20s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
          stockEmitter.off('update', listener);
        }
      }, 20000);

      // Clean up when client disconnects
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        stockEmitter.off('update', listener);
        try {
          controller.close();
        } catch {
          // Already closed
        }
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
