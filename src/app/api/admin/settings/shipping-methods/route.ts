export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const shippingMethods = await dbQuery<any[]>('SELECT * FROM shipping_methods ORDER BY id DESC');
    const parsed = shippingMethods.map(sm => ({
      ...sm,
      is_active: sm.is_active === 1
    }));
    return NextResponse.json({ success: true, shippingMethods: parsed });
  } catch (error: any) {
    console.error('Error fetching admin shipping methods:', error);
    return NextResponse.json({ error: 'Error al cargar métodos de envío.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const { name, cost, estimated_time, description } = (await req.json()) as any;

    if (!name || cost === undefined || !estimated_time) {
      return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 });
    }

    await dbQuery(
      'INSERT INTO shipping_methods (name, cost, estimated_time, description, is_active) VALUES (?, ?, ?, ?, 1)',
      [name, parseFloat(cost), estimated_time, description || '']
    );

    return NextResponse.json({ success: true, message: 'Método de envío creado con éxito.' });
  } catch (error: any) {
    console.error('Error creating shipping method:', error);
    return NextResponse.json({ error: 'Error al crear el método de envío.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const { id, name, cost, estimated_time, description, is_active } = (await req.json()) as any;

    if (!id || !name || cost === undefined || !estimated_time) {
      return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 });
    }

    await dbQuery(
      'UPDATE shipping_methods SET name = ?, cost = ?, estimated_time = ?, description = ?, is_active = ? WHERE id = ?',
      [name, parseFloat(cost), estimated_time, description || '', is_active ? 1 : 0, id]
    );

    return NextResponse.json({ success: true, message: 'Método de envío actualizado con éxito.' });
  } catch (error: any) {
    console.error('Error updating shipping method:', error);
    return NextResponse.json({ error: 'Error al actualizar el método de envío.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Falta el ID del método de envío.' }, { status: 400 });
    }

    await dbQuery('DELETE FROM shipping_methods WHERE id = ?', [id]);

    return NextResponse.json({ success: true, message: 'Método de envío eliminado con éxito.' });
  } catch (error: any) {
    console.error('Error deleting shipping method:', error);
    return NextResponse.json({ error: 'Error al eliminar el método de envío.' }, { status: 500 });
  }
}
