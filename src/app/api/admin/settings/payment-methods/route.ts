import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const paymentMethods = await dbQuery<any[]>('SELECT * FROM payment_methods ORDER BY id DESC');
    const parsed = paymentMethods.map(pm => ({
      ...pm,
      details: pm.details ? JSON.parse(pm.details) : {},
      requires_proof: pm.requires_proof === 1,
      is_active: pm.is_active === 1
    }));
    return NextResponse.json({ success: true, paymentMethods: parsed });
  } catch (error: any) {
    console.error('Error fetching admin payment methods:', error);
    return NextResponse.json({ error: 'Error al cargar métodos de pago.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const { name, type, category, details, requires_proof } = (await req.json()) as any;

    if (!name || !type || !category || !details) {
      return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 });
    }

    const detailsStr = typeof details === 'string' ? details : JSON.stringify(details);

    await dbQuery(
      'INSERT INTO payment_methods (name, type, category, details, requires_proof, is_active) VALUES (?, ?, ?, ?, ?, 1)',
      [name, type, category, detailsStr, requires_proof ? 1 : 0]
    );

    return NextResponse.json({ success: true, message: 'Método de pago creado con éxito.' });
  } catch (error: any) {
    console.error('Error creating payment method:', error);
    return NextResponse.json({ error: 'Error al crear el método de pago.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const { id, name, type, category, details, requires_proof, is_active } = (await req.json()) as any;

    if (!id || !name || !type || !category || !details) {
      return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 });
    }

    const detailsStr = typeof details === 'string' ? details : JSON.stringify(details);

    await dbQuery(
      'UPDATE payment_methods SET name = ?, type = ?, category = ?, details = ?, requires_proof = ?, is_active = ? WHERE id = ?',
      [name, type, category, detailsStr, requires_proof ? 1 : 0, is_active ? 1 : 0, id]
    );

    return NextResponse.json({ success: true, message: 'Método de pago actualizado con éxito.' });
  } catch (error: any) {
    console.error('Error updating payment method:', error);
    return NextResponse.json({ error: 'Error al actualizar el método de pago.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Falta el ID del método de pago.' }, { status: 400 });
    }

    await dbQuery('DELETE FROM payment_methods WHERE id = ?', [id]);

    return NextResponse.json({ success: true, message: 'Método de pago eliminado con éxito.' });
  } catch (error: any) {
    console.error('Error deleting payment method:', error);
    return NextResponse.json({ error: 'Error al eliminar el método de pago.' }, { status: 500 });
  }
}
