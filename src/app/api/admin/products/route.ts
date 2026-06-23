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


export async function GET(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const rawLimit = parseInt(searchParams.get('limit') || '1000', 10);
  const limit = Math.min(Math.max(1, rawLimit), 1000);

  try {
    const products = await dbQuery<any[]>(`
      SELECT id, name, price, stock, is_active, type, slug, category_id, barcode, supplier_id, min_stock_alert
      FROM products
      ORDER BY name ASC
      LIMIT ?
    `, [limit]);
    return NextResponse.json({ success: true, products });
  } catch (error: any) {
    console.error('GET Admin Products Error:', error);
    return NextResponse.json({ error: 'Error al obtener productos.' }, { status: 500 });
  }
}

function slugify(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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

export async function POST(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const fd = await req.formData();
    const name = fd.get('name') as string;
    const slug = (fd.get('slug') as string) || slugify(name);
    const category_id = fd.get('category_id') || null;
    const short_desc = fd.get('short_desc') as string | null;
    const description = fd.get('description') as string | null;
    const price = parseFloat(fd.get('price') as string);
    const stock = parseInt(fd.get('stock') as string) || 0;
    const type = fd.get('type') as string;
    const is_featured = fd.get('is_featured') === 'true' ? 1 : 0;
    
    const rawActive = fd.get('is_active');
    let is_active = 0;
    if (rawActive === 'true' || rawActive === '1') {
      is_active = 1;
    } else if (rawActive === '2' || rawActive === 'pending') {
      is_active = 2;
    } else {
      is_active = 0;
    }

    const es_subproducto = fd.get('es_subproducto') === 'true' ? 1 : 0;
    const id_producto_padre = fd.get('id_producto_padre') ? parseInt(fd.get('id_producto_padre') as string) : null;
    const unidades_por_padre = fd.get('unidades_por_padre') ? parseInt(fd.get('unidades_por_padre') as string) : null;
    const supplier_id = fd.get('supplier_id') ? parseInt(fd.get('supplier_id') as string) : null;
    const purchase_url = fd.get('purchase_url') as string | null;
    const min_stock_alert = fd.get('min_stock_alert') ? parseInt(fd.get('min_stock_alert') as string) : 3;
    const barcode = (fd.get('barcode') as string)?.trim() || null;
    const price_type = (fd.get('price_type') as string) || 'fixed';
    const price_max = fd.get('price_max') ? parseFloat(fd.get('price_max') as string) : null;

    let image = null, image2 = null, image3 = null;
    const imgFile = fd.get('image') as File | null;
    const img2File = fd.get('image2') as File | null;
    const img3File = fd.get('image3') as File | null;
    if (imgFile?.size) image = await saveImage(imgFile, 'prod');
    if (img2File?.size) image2 = await saveImage(img2File, 'prod2');
    if (img3File?.size) image3 = await saveImage(img3File, 'prod3');

    await dbQuery(
      `INSERT INTO products (category_id, name, slug, short_desc, description, price, stock, type, image, image2, image3, is_featured, is_active, es_subproducto, id_producto_padre, unidades_por_padre, supplier_id, purchase_url, min_stock_alert, barcode, price_type, price_max)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [category_id || null, name, slug, short_desc, description, price, stock, type, image, image2, image3, is_featured, is_active, es_subproducto, id_producto_padre, unidades_por_padre, supplier_id, purchase_url, min_stock_alert, barcode, price_type, price_max]
    );

    await logAdminAction(
      admin,
      'Creación de producto',
      `Creado nuevo producto: ${name} (Precio: $${price}, Stock: ${stock}, Tipo: ${type}, Estado: ${is_active === 2 ? 'Por completar' : is_active === 1 ? 'Activo' : 'Inactivo'})`
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const msg = error.message || '';
    if (msg.includes('UNIQUE constraint failed: products.slug')) {
      return NextResponse.json({ error: 'Ya existe un producto con ese slug (nombre de URL similar).' }, { status: 409 });
    }
    if (msg.includes('UNIQUE constraint failed: products.barcode')) {
      return NextResponse.json({ error: 'Ya existe un producto con ese código de barras.' }, { status: 409 });
    }
    if (error.code === 'ER_DUP_ENTRY') return NextResponse.json({ error: 'Ya existe un producto con ese slug.' }, { status: 409 });
    console.error('Create product error:', error);
    return NextResponse.json({ error: 'Error al crear producto.' }, { status: 500 });
  }
}
