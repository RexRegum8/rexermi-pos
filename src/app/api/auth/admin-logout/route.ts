import { NextResponse } from 'next/server';
import { clearSession, clearAdminSession } from '@/lib/auth';

export async function POST() {
  await clearSession();
  await clearAdminSession();
  return NextResponse.json({ success: true });
}
