export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdminToken(req);
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const reviewId = parseInt(id, 10);
    if (isNaN(reviewId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = (await req.json()) as any;
    const { status } = body as { status: 'approved' | 'hidden' };

    if (!status || !['approved', 'hidden'].includes(status)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
    }

    await dbQuery(
      'UPDATE product_reviews SET status = ? WHERE id = ?',
      [status, reviewId]
    );

    return NextResponse.json({ success: true, message: 'Estado de calificación actualizado' });
  } catch (error: any) {
    console.error('Error updating review status:', error);
    return NextResponse.json({ error: 'Error al actualizar calificación' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdminToken(req);
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const reviewId = parseInt(id, 10);
    if (isNaN(reviewId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    await dbQuery('DELETE FROM product_reviews WHERE id = ?', [reviewId]);

    return NextResponse.json({ success: true, message: 'Calificación eliminada permanentemente' });
  } catch (error: any) {
    console.error('Error deleting review:', error);
    return NextResponse.json({ error: 'Error al eliminar calificación' }, { status: 500 });
  }
}
