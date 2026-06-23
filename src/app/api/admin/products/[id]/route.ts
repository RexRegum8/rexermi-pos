import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';
import { isValidImageOrPdfBuffer } from '@/lib/helpers';
import { logAdminAction } from '@/lib/audit';

export const runtime = 'edge';

let fs: any = null;
let path: any = null;

if (typeof EdgeRuntime !== 'string') {
  const requireFunc = typeof __webpack_require__ === "function" ? __non_webpack_require__ : require;
  fs = requireFunc('fs');
  path = requireFunc('path');
}


async function saveImage(file: File, prefix: string): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!isValidImageOrPdfBuffer(buffer)) {
    throw new Error('Archivo de imagen inválido o corrupto.');
  }
  const ext = path.extname(file.name) || '.jpg';
  const filename = `${prefix}_${Date.now()}${ext}`;
  const dir = path.join(process['cwd'](), 'public', 'assets', 'uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), buffer);
  return filename;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const { id } = await params;
  try {
    const fd = await req.formData();
    const currentProd = await dbQuery<{stock: number}[]>('SELECT stock FROM products WHERE id = ?', [id]);
    const oldStock = currentProd.length > 0 ? currentProd[0].stock : 0;
    const newStock = parseInt(fd.get('stock') as string) || 0;
    const es_subproducto = fd.get('es_subproducto') === 'true' ? 1 : 0;
    const id_producto_padre = fd.get('id_producto_padre') ? parseInt(fd.get('id_producto_padre') as string) : null;
    const unidades_por_padre = fd.get('unidades_por_padre') ? parseInt(fd.get('unidades_por_padre') as string) : null;

    const min_stock_alert = fd.get('min_stock_alert') ? parseInt(fd.get('min_stock_alert') as string) : 3;

    const rawActive = fd.get('is_active');
    let is_active = 0;
    if (rawActive === 'true' || rawActive === '1') {
      is_active = 1;
    } else if (rawActive === '2' || rawActive === 'pending') {
      is_active = 2;
    } else {
      is_active = 0;
    }

    const updates: Record<string, any> = {
      name: fd.get('name'), slug: fd.get('slug'),
      category_id: fd.get('category_id') || null,
      short_desc: fd.get('short_desc'), description: fd.get('description'),
      price: parseFloat(fd.get('price') as string),
      stock: newStock,
      type: fd.get('type'),
      is_featured: fd.get('is_featured') === 'true' ? 1 : 0,
      is_active,
      es_subproducto,
      id_producto_padre,
      unidades_por_padre,
      supplier_id: fd.get('supplier_id') ? parseInt(fd.get('supplier_id') as string) : null,
      purchase_url: fd.get('purchase_url') as string | null,
      min_stock_alert,
      barcode: (fd.get('barcode') as string)?.trim() || null,
      price_type: (fd.get('price_type') as string) || 'fixed',
      price_max: fd.get('price_max') ? parseFloat(fd.get('price_max') as string) : null,
    };

    const imgFile = fd.get('image') as File | null;
    const img2File = fd.get('image2') as File | null;
    const img3File = fd.get('image3') as File | null;
    if (imgFile?.size) updates.image = await saveImage(imgFile, 'prod');
    if (img2File?.size) updates.image2 = await saveImage(img2File, 'prod2');
    if (img3File?.size) updates.image3 = await saveImage(img3File, 'prod3');

    const cols = Object.keys(updates).map(k => `\`${k}\` = ?`).join(', ');
    const vals = [...Object.values(updates), id];
    await dbQuery(`UPDATE products SET ${cols} WHERE id = ?`, vals);

    if (oldStock !== newStock) {
      await dbQuery(
        'INSERT INTO inventory_movements (product_id, movement_type, quantity_change, previous_stock, new_stock, reference_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, 'manual_adjustment', newStock - oldStock, oldStock, newStock, `Admin-${admin.id}`, `Ajuste manual por Admin ${admin.username}`]
      );
    }

    await logAdminAction(
      admin,
      'Modificación de producto',
      `Actualizado producto con ID ${id} (${updates.name}, Stock: ${newStock}, Precio: $${updates.price})`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update product error:', error);
    return NextResponse.json({ error: 'Error al actualizar producto.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  const { id } = await params;
  await dbQuery('UPDATE products SET is_active = 0 WHERE id = ?', [id]);

  await logAdminAction(
    admin,
    'Desactivación de producto',
    `Inactivado / Desactivado (Soft delete) producto con ID ${id}.`
  );

  return NextResponse.json({ success: true });
}
