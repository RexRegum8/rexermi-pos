import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const { id } = await context.params;
    const supplierId = parseInt(id, 10);
    const { name, contact_name, email, phone, address, notes } = (await req.json()) as any;

    if (isNaN(supplierId)) {
      return NextResponse.json({ error: 'ID de proveedor inválido.' }, { status: 400 });
    }

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'El nombre del proveedor es obligatorio.' }, { status: 400 });
    }

    const existing = await dbQuery<any[]>('SELECT id FROM suppliers WHERE id = ?', [supplierId]);
    if (existing.length === 0) {
      return NextResponse.json({ error: 'El proveedor no existe.' }, { status: 404 });
    }

    await dbQuery(
      `UPDATE suppliers 
       SET name = ?, contact_name = ?, email = ?, phone = ?, address = ?, notes = ?, updated_at = datetime('now') 
       WHERE id = ?`,
      [
        name.trim(),
        contact_name ? contact_name.trim() : null,
        email ? email.trim().toLowerCase() : null,
        phone ? phone.trim() : null,
        address ? address.trim() : null,
        notes ? notes.trim() : null,
        supplierId
      ]
    );

    return NextResponse.json({ success: true, message: 'Proveedor actualizado correctamente.' });
  } catch (error: any) {
    console.error('PUT Supplier Error:', error);
    return NextResponse.json({ error: 'Error al actualizar proveedor.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const { id } = await context.params;
    const supplierId = parseInt(id, 10);

    if (isNaN(supplierId)) {
      return NextResponse.json({ error: 'ID de proveedor inválido.' }, { status: 400 });
    }

    // Check if supplier has pending purchase orders to warn the admin
    const pendingOrders = await dbQuery<any[]>(
      "SELECT id FROM purchase_orders WHERE supplier_id = ? AND status = 'pending'",
      [supplierId]
    );

    if (pendingOrders.length > 0) {
      return NextResponse.json({ 
        error: 'No se puede eliminar el proveedor porque tiene órdenes de compra pendientes registradas. Procéselas o cancílelas primero.' 
      }, { status: 400 });
    }

    await dbQuery('DELETE FROM suppliers WHERE id = ?', [supplierId]);

    return NextResponse.json({ success: true, message: 'Proveedor eliminado correctamente.' });
  } catch (error: any) {
    console.error('DELETE Supplier Error:', error);
    return NextResponse.json({ error: 'Error al eliminar proveedor.' }, { status: 500 });
  }
}
