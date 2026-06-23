import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const barcode = searchParams.get('barcode');

  if (!barcode) {
    return NextResponse.json({ error: 'Falta el parámetro barcode.' }, { status: 400 });
  }

  try {
    // Controller to abort request if it takes too long (timeout)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s timeout

    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'RexermiApp - Web - Version 1.0'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json({ success: false, error: 'La API externa retornó error.' });
    }

    const data = (await response.json()) as any;
    if (data.status === 1 && data.product) {
      const p = data.product;
      return NextResponse.json({
        success: true,
        name: p.product_name || p.product_name_es || null,
        brand: p.brands || null,
        description: p.generic_name || p.generic_name_es || p.categories || null,
        image_url: p.image_front_url || p.image_url || null
      });
    }

    return NextResponse.json({ success: false, error: 'Producto no encontrado en la base de datos externa.' });
  } catch (error: any) {
    console.warn('Barcode lookup error:', error.message || error);
    return NextResponse.json({ success: false, error: 'Timeout o error de red en la consulta externa.' });
  }
}
