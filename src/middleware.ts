import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET env variable is required');
}
const JWT_SECRET = process.env.JWT_SECRET;
const secretKey = new TextEncoder().encode(JWT_SECRET);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 0. Case-insensitive and old path redirections
  if (pathname.toLowerCase() === '/pos' && pathname !== '/pos') {
    return NextResponse.redirect(new URL('/pos', request.url));
  }
  if (pathname.startsWith('/vendedor')) {
    const subpath = pathname.substring(9);
    return NextResponse.redirect(new URL(`/pos${subpath}`, request.url));
  }

  // 1. Admin paths
  if ((pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) && pathname !== '/admin/login') {
    let adminToken = request.cookies.get('rexermi_admin_session')?.value;
    if (!adminToken) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        adminToken = authHeader.substring(7);
      }
    }
    let isAuthorized = false;

    if (adminToken) {
      try {
        const { payload } = await jwtVerify(adminToken, secretKey);
        if (payload && (payload.role === 'admin' || payload.role === 'custom')) {
          isAuthorized = true;
        }
      } catch {
        isAuthorized = false;
      }
    }

    if (!isAuthorized) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
      }
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 2. Vendedor (POS) paths
  if (pathname.startsWith('/pos') || pathname.startsWith('/api/vendedor')) {
    let userCookie = request.cookies.get('rexermi_session')?.value;
    if (!userCookie) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        userCookie = authHeader.substring(7);
      }
    }
    let isAuthorized = false;

    if (userCookie) {
      try {
        const { payload }: any = await jwtVerify(userCookie, secretKey);
        if (payload && (payload.role === 'vendedor' || payload.role === 'admin' || payload.role === 'custom')) {
          isAuthorized = true;
        }
      } catch {
        isAuthorized = false;
      }
    }

    // Fallback: If not authorized by rexermi_session, check if we have a valid rexermi_admin_session
    if (!isAuthorized) {
      const adminCookie = request.cookies.get('rexermi_admin_session')?.value;
      if (adminCookie) {
        try {
          const { payload }: any = await jwtVerify(adminCookie, secretKey);
          if (payload && (payload.role === 'admin' || payload.role === 'custom')) {
            isAuthorized = true;
          }
        } catch {
          isAuthorized = false;
        }
      }
    }

    if (!isAuthorized) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
      }
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/pos/:path*',
    '/POS/:path*',
    '/POS',
    '/vendedor/:path*',
    '/vendedor',
    '/api/vendedor/:path*',
  ],
};
