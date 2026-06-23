export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const barcode = searchParams.get('barcode');
    
    if (!barcode) {
      return NextResponse.json({ error: 'Barcode parameter is required' }, { status: 400 });
    }

    // SQLite exact query by barcode
    const query = `
      SELECT p.id, p.name, p.price, p.stock, p.type, p.slug, p.image, p.barcode,
             p.es_subproducto, p.id_producto_padre, p.unidades_por_padre,
             parent.stock AS parent_stock
      FROM products p
      LEFT JOIN products parent ON p.id_producto_padre = parent.id
      WHERE p.barcode = ? AND p.is_active = 1
      LIMIT 1
    `;
    
    const results = await dbQuery<any[]>(query, [barcode]);
    
    if (!results || results.length === 0) {
      // If not found, return 404 or empty JSON as requested
      return NextResponse.json({}, { status: 404 });
    }
    
    const p = results[0];
    
    // Calculate virtual stock for subproducts if parent has stock
    let virtualStock = p.stock;
    if (p.type === 'product' && p.es_subproducto === 1 && p.id_producto_padre !== null && p.unidades_por_padre > 0) {
      const parentStock = p.parent_stock !== null ? p.parent_stock : 0;
      virtualStock = p.stock + (parentStock * p.unidades_por_padre);
    }

    const product = {
      id: p.id,
      name: p.name,
      price: p.price,
      stock: virtualStock,
      type: p.type,
      slug: p.slug,
      image: p.image,
      barcode: p.barcode
    };

    return NextResponse.json(product);
  } catch (error) {
    console.error('API Vendedor Products Barcode Error:', error);
    return NextResponse.json({ error: 'Error fetching product by barcode' }, { status: 500 });
  }
}
