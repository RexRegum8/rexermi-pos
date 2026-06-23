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

    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json({ error: 'Falta orderId' }, { status: 400 });
    }

    const reviews = await dbQuery<any[]>(
      'SELECT id FROM product_reviews WHERE order_id = ? AND user_id = ?',
      [parseInt(orderId, 10), session.id]
    );

    return NextResponse.json({
      success: true,
      rated: reviews.length > 0
    });
  } catch (error: any) {
    console.error('Error fetching review status:', error);
    return NextResponse.json({ error: 'Error al verificar estado de calificación' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const limitResult = await checkRateLimit(`ip:${ip}:reviews`, 5, 60000); // 5 per minute
    if (!limitResult.success) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes de calificación. Intenta de nuevo más tarde.' },
        { status: 429 }
      );
    }

    const session = await verifyCustomerToken(req);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = (await req.json()) as any;
    const { orderId, ratings } = body as {
      orderId: number;
      ratings: Array<{ productId: number; rating: number; comment?: string }>;
    };

    if (!orderId || !ratings || !Array.isArray(ratings) || ratings.length === 0) {
      return NextResponse.json({ error: 'Datos de calificación inválidos' }, { status: 400 });
    }

    // 1. Verify order exists, belongs to user, and is delivered
    const orders = await dbQuery<any[]>(
      'SELECT id, status FROM orders WHERE id = ? AND user_id = ?',
      [orderId, session.id]
    );

    if (orders.length === 0) {
      return NextResponse.json({ error: 'El pedido no existe o no te pertenece' }, { status: 404 });
    }

    const order = orders[0];
    if (order.status !== 'delivered') {
      return NextResponse.json({ error: 'Solo puedes calificar pedidos que han sido entregados' }, { status: 400 });
    }

    // 2. Check if already rated
    const existingReviews = await dbQuery<any[]>(
      'SELECT id FROM product_reviews WHERE order_id = ?',
      [orderId]
    );

    if (existingReviews.length > 0) {
      return NextResponse.json({ error: 'Este pedido ya ha sido calificado' }, { status: 400 });
    }

    // 3. Validate ratings
    for (const item of ratings) {
      if (typeof item.productId !== 'number' || typeof item.rating !== 'number') {
        return NextResponse.json({ error: 'Formato de producto o valoración incorrecto' }, { status: 400 });
      }
      if (item.rating < 1 || item.rating > 5) {
        return NextResponse.json({ error: 'La valoración debe ser entre 1 y 5 estrellas' }, { status: 400 });
      }
    }

    // 4. Save reviews to database
    // Using simple loop with dbQuery (since dbQuery handles run/all internally)
    for (const item of ratings) {
      await dbQuery(
        `INSERT INTO product_reviews (user_id, product_id, order_id, rating, comment, status)
         VALUES (?, ?, ?, ?, ?, 'approved')`,
        [session.id, item.productId, orderId, item.rating, item.comment?.trim() || null]
      );
    }

    return NextResponse.json({ success: true, message: '¡Gracias por calificar tu compra!' });
  } catch (error: any) {
    console.error('Error submitting reviews:', error);
    return NextResponse.json({ error: 'Error al guardar calificaciones' }, { status: 500 });
  }
}
