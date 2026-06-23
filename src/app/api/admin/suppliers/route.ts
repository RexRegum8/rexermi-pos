export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const suppliers = await dbQuery<any[]>('SELECT * FROM suppliers ORDER BY name');
    return NextResponse.json({ success: true, suppliers });
  } catch (error: any) {
    console.error('GET Suppliers Error:', error);
    return NextResponse.json({ error: 'Error al obtener proveedores.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const { name, contact_name, email, phone, address, notes } = (await req.json()) as any;

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'El nombre del proveedor es obligatorio.' }, { status: 400 });
    }

    const result = await dbQuery<any>(
      `INSERT INTO suppliers (name, contact_name, email, phone, address, notes, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        name.trim(),
        contact_name ? contact_name.trim() : null,
        email ? email.trim().toLowerCase() : null,
        phone ? phone.trim() : null,
        address ? address.trim() : null,
        notes ? notes.trim() : null
      ]
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Proveedor creado correctamente.', 
      supplierId: result.insertId 
    });
  } catch (error: any) {
    console.error('POST Supplier Error:', error);
    return NextResponse.json({ error: 'Error al crear proveedor.' }, { status: 500 });
  }
}
