export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const idsParam = searchParams.get('ids');
    const limit = searchParams.get('limit') || '50';
    
    let query = `
      SELECT p.id, p.name, p.price, p.stock, p.type, p.slug, p.image, p.barcode,
             p.es_subproducto, p.id_producto_padre, p.unidades_por_padre,
             p.price_type, p.price_max,
             parent.stock AS parent_stock,
             c.name AS cat_name,
             (
               SELECT poi.cost_price 
               FROM purchase_order_items poi
               JOIN purchase_orders po ON po.id = poi.purchase_order_id
               WHERE poi.product_id = p.id AND po.status = 'received'
               ORDER BY po.received_at DESC
               LIMIT 1
             ) AS last_cost_price
      FROM products p
      LEFT JOIN products parent ON p.id_producto_padre = parent.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1
    `;
    let params: any[] = [];
    
    if (idsParam) {
      const ids = idsParam.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        query += ` AND p.id IN (${placeholders})`;
        params.push(...ids);
      }
    } else if (search) {
      query += ' AND (p.name LIKE ? OR p.id LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    query += ' ORDER BY p.name ASC LIMIT ?';
    params.push(parseInt(limit, 10));
    
    const rawProducts = await dbQuery<any[]>(query, params);
    const products = rawProducts.map(p => {
      let virtualStock = p.stock;
      if (p.type === 'product' && p.es_subproducto === 1 && p.id_producto_padre !== null && p.unidades_por_padre > 0) {
        const parentStock = p.parent_stock !== null ? p.parent_stock : 0;
        virtualStock = p.stock + (parentStock * p.unidades_por_padre);
      }
      return {
        id: p.id,
        name: p.name,
        price: p.price,
        stock: virtualStock,
        type: p.type,
        slug: p.slug,
        image: p.image,
        barcode: p.barcode,
        cost_price: p.last_cost_price !== null ? p.last_cost_price : 0.0,
        price_type: p.price_type || 'fixed',
        price_max: p.price_max,
        cat_name: p.cat_name
      };
    });
    
    return NextResponse.json(
      { success: true, products },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
        }
      }
    );
  } catch (error) {
    console.error('API Products Error:', error);
    return NextResponse.json({ error: 'Error fetching products' }, { status: 500 });
  }
}
