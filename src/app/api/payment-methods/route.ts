import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const paymentMethods = await dbQuery<any[]>(
      'SELECT id, name, type, category, details, requires_proof FROM payment_methods WHERE is_active = 1'
    );
    const parsed = paymentMethods.map(pm => ({
      ...pm,
      details: pm.details ? JSON.parse(pm.details) : {},
      requires_proof: pm.requires_proof === 1
    }));
    return NextResponse.json({ success: true, paymentMethods: parsed });
  } catch (error: any) {
    console.error('Error fetching public payment methods:', error);
    return NextResponse.json({ error: 'Error al cargar métodos de pago.' }, { status: 500 });
  }
}
