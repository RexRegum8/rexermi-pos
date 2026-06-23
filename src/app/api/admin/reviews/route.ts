import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const admin = await verifyAdminToken(req);
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const reviews = await dbQuery<any[]>(
      `SELECT r.id, r.user_id, r.product_id, r.order_id, r.rating, r.comment, r.status, r.created_at,
              p.name as product_name, p.slug as product_slug, p.image as product_image,
              COALESCE(u.full_name, 'Cliente de Rexermi') as user_name, u.email as user_email,
              o.order_number
       FROM product_reviews r
       JOIN products p ON r.product_id = p.id
       LEFT JOIN users u ON r.user_id = u.id
       JOIN orders o ON r.order_id = o.id
       ORDER BY r.created_at DESC`
    );

    return NextResponse.json({ success: true, reviews });
  } catch (error: any) {
    console.error('Error fetching admin reviews:', error);
    return NextResponse.json({ error: 'Error al cargar calificaciones' }, { status: 500 });
  }
}
