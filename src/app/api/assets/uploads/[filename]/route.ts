import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface RouteParams {
  params: Promise<{ filename: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { filename } = await params;

  // Evitar Directory Traversal para seguridad
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return new NextResponse('Nombre de archivo no válido.', { status: 400 });
  }

  const filePath = path.join(process.cwd(), 'public', 'assets', 'uploads', filename);

  if (!fs.existsSync(filePath)) {
    return new NextResponse('Archivo no encontrado.', { status: 404 });
  }

  try {
    const fileBuffer = fs.readFileSync(filePath);
    
    // Determinar Content-Type según la extensión
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.svg') contentType = 'image/svg+xml';
    else if (ext === '.pdf') contentType = 'application/pdf';

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, must-revalidate', // 1 día de caché
    };
    if (ext === '.svg') {
      headers['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Error al servir imagen de producto:', error);
    return new NextResponse('Error al leer el archivo.', { status: 500 });
  }
}
