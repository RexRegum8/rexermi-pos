import { NextRequest, NextResponse } from 'next/server';
import { getSession, getAdminSession } from '@/lib/auth';
import { dbQuery } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await context.params;

    // Check auth: either admin session or customer session
    const admin = await getAdminSession();
    let isAuthorized = false;

    if (admin) {
      isAuthorized = true;
    } else {
      const customer = await getSession();
      if (customer) {
        // Query database to verify if this customer owns an order with this receipt
        const orders = await dbQuery<any[]>(
          'SELECT id FROM orders WHERE payment_proof = ? AND user_id = ?',
          [filename, customer.id]
        );
        if (orders.length > 0) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return new NextResponse('No autorizado', { status: 401 });
    }

    // Resolve file path
    const filePath = path.join(process.cwd(), 'private', 'receipts', filename);
    if (!fs.existsSync(filePath)) {
      return new NextResponse('Archivo no encontrado', { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    
    // Determine content type
    let contentType = 'application/octet-stream';
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.pdf') contentType = 'application/pdf';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error serving receipt:', error);
    return new NextResponse('Error interno', { status: 500 });
  }
}
