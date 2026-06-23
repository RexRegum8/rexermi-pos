export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const shippingMethods = await dbQuery<any[]>(
      'SELECT id, name, cost, estimated_time, description FROM shipping_methods WHERE is_active = 1'
    );
    return NextResponse.json({ success: true, shippingMethods });
  } catch (error: any) {
    console.error('Error fetching public shipping methods:', error);
    return NextResponse.json({ error: 'Error al cargar métodos de envío.' }, { status: 500 });
  }
}
