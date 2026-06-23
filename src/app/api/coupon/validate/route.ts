import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';

interface Coupon {
  id: number;
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_order: number;
  uses_left: number | null;
  is_active: number;
  expires_at: string | null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code')?.toUpperCase().trim();
  const total = parseFloat(searchParams.get('total') || '0');

  if (!code) {
    return NextResponse.json({ error: 'Código de cupón requerido.' }, { status: 400 });
  }

  try {
    const coupons = await dbQuery<Coupon[]>(
      'SELECT * FROM coupons WHERE code = ? AND is_active = 1',
      [code]
    );

    if (!coupons.length) {
      return NextResponse.json({ error: 'Cupón inválido o no existe.' }, { status: 404 });
    }

    const coupon = coupons[0];

    // Check expiration
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Este cupón ha expirado.' }, { status: 400 });
    }

    // Check uses remaining
    if (coupon.uses_left !== null && coupon.uses_left <= 0) {
      return NextResponse.json({ error: 'Este cupón ya no tiene usos disponibles.' }, { status: 400 });
    }

    // Check minimum order
    if (total < coupon.min_order) {
      return NextResponse.json(
        { error: `Pedido mínimo de $${coupon.min_order.toFixed(2)} requerido para este cupón.` },
        { status: 400 }
      );
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discount_type === 'percent') {
      discountAmount = (total * coupon.discount_value) / 100;
    } else {
      discountAmount = Math.min(coupon.discount_value, total);
    }

    return NextResponse.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
      },
      discount_amount: parseFloat(discountAmount.toFixed(2)),
      new_total: parseFloat((total - discountAmount).toFixed(2)),
    });
  } catch (error) {
    console.error('Error validating coupon:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
