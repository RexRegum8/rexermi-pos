import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomerToken } from '@/lib/auth';

/**
 * GET /api/auth/me
 * Returns the current user session info.
 * Used by the checkout page to verify authentication status on load (M-13 fix).
 */
export async function GET(req: NextRequest) {
  const user = await verifyCustomerToken(req);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }
  return NextResponse.json({ user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } });
}
