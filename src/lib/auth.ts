import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from './db';

import { getRequestContext } from '@cloudflare/next-on-pages';

let cachedSecretKey: Uint8Array | null = null;

function getSecretKey(): Uint8Array {
  if (cachedSecretKey) return cachedSecretKey;

  let jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    try {
      jwtSecret = (getRequestContext()?.env as any)?.JWT_SECRET;
    } catch {}
  }
  if (!jwtSecret) {
    jwtSecret = 'mi_clave_secreta_super_segura_pos_2026';
  }
  cachedSecretKey = new TextEncoder().encode(jwtSecret);
  return cachedSecretKey;
}

export interface UserSession {
  id: number;
  email: string;
  fullName: string;
  role: 'user' | 'admin' | 'vendedor' | string;
}

export interface AdminSession {
  id: number;
  username: string;
  role: string;
}

// ─── Password Utilities ───────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  // PHP bcrypt hashes start with $2y$; bcryptjs needs $2a$
  const normalizedHash = hash.replace(/^\$2[yb]\$/, '$2a$');
  return bcrypt.compare(password, normalizedHash);
}

// ─── JWT Utilities ────────────────────────────────────────────────────────────

export async function createToken(payload: object, expiresIn: string = '48h'): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecretKey());
}

export async function verifyToken<T = object>(token: string): Promise<T | null> {
  try {
    // Check if token is revoked in SQLite
    const revokedRows = await dbQuery<any[]>('SELECT 1 FROM revoked_tokens WHERE token = ?', [token]);
    if (revokedRows && revokedRows.length > 0) return null;

    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as T;
  } catch (err) {
    console.error('verifyToken failed:', err);
    return null;
  }
}

// ─── Server-Side Cookie Helpers (Server Components / Route Handlers using next/headers) ──

export async function setSession(session: UserSession) {
  const token = await createToken(session);
  const cookieStore = await cookies();
  cookieStore.set('rexermi_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 2, // 48h
    path: '/',
  });
}

export async function getSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('rexermi_session')?.value;
  if (!token) return null;
  return verifyToken<UserSession>(token);
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('rexermi_session')?.value;
  if (token) {
    try {
      await dbQuery('INSERT OR IGNORE INTO revoked_tokens (token, revoked_at) VALUES (?, ?)', [token, Date.now()]);
      // Prune tokens expired more than 48 hours ago
      await dbQuery('DELETE FROM revoked_tokens WHERE revoked_at < ?', [Date.now() - 48 * 60 * 60 * 1000]);
    } catch (e) {
      console.error('Failed to revoke session token', e);
    }
  }
  cookieStore.delete('rexermi_session');
  cookieStore.set('rexermi_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    expires: new Date(0),
    path: '/',
  });
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('rexermi_admin_session')?.value;
  if (!token) return null;
  return verifyToken<AdminSession>(token);
}

export async function getPOSSession(): Promise<UserSession | null> {
  const session = await getSession();
  if (session && (session.role === 'vendedor' || session.role === 'admin' || session.role === 'custom')) {
    if (session.role === 'custom') {
      const userRows = await dbQuery<{ permissions: string }[]>('SELECT permissions FROM users WHERE id = ?', [session.id]);
      const user = userRows[0];
      if (user) {
        try {
          const perms = JSON.parse(user.permissions || '{}');
          if (!perms.pos_access) return null;
        } catch {
          return null;
        }
      } else {
        return null;
      }
    }
    return session;
  }

  const adminSession = await getAdminSession();
  if (adminSession) {
    const adminUserRows = await dbQuery<{ id: number; username: string; email: string; full_name: string }[]>('SELECT id, username, email, full_name FROM admin_users WHERE id = ?', [adminSession.id]);
    const adminUser = adminUserRows[0];
    if (adminUser) {
      const userRows = await dbQuery<{ id: number; email: string; full_name: string; role: string }[]>('SELECT id, email, full_name, role FROM users WHERE email = ?', [adminUser.email]);
      let user = userRows[0];
      if (!user) {
        try {
          const info = await dbQuery(
            `INSERT INTO users (full_name, email, password, role, is_active) VALUES (?, ?, ?, 'admin', 1)`,
            [adminUser.full_name, adminUser.email, 'ADMIN_AUTO_CREATED_PASS']
          );
          user = {
            id: Number(info.insertId),
            email: adminUser.email,
            full_name: adminUser.full_name,
            role: 'admin'
          };
        } catch (e) {
          console.error('Failed to auto-create user entry for admin', e);
        }
      }
      if (user) {
        return {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: 'admin'
        };
      }
    }
  }
  return null;
}

export async function getAdminPermissions(): Promise<Record<string, boolean> | null> {
  const session = await getAdminSession();
  if (!session) return null;

  if ((session as any).isUserTable) {
    const userRows = await dbQuery<{ role: string; permissions: string }[]>('SELECT role, permissions FROM users WHERE id = ? AND is_active = 1', [session.id]);
    const user = userRows[0];
    if (!user) return null;

    if (user.role === 'admin') {
      return {
        admin_access: true,
        pos_access: true,
        edit_products: true,
        view_reports: true,
        manage_users: true,
        manage_credits: true,
      };
    } else if (user.role === 'custom') {
      try {
        return JSON.parse(user.permissions || '{}');
      } catch {
        return {};
      }
    }
    return {};
  } else {
    // Super admin from admin_users
    return {
      admin_access: true,
      pos_access: true,
      edit_products: true,
      view_reports: true,
      manage_users: true,
      manage_credits: true,
    };
  }
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('rexermi_admin_session')?.value;
  if (token) {
    try {
      await dbQuery('INSERT OR IGNORE INTO revoked_tokens (token, revoked_at) VALUES (?, ?)', [token, Date.now()]);
    } catch (e) {
      console.error('Failed to revoke admin session token', e);
    }
  }
  cookieStore.delete('rexermi_admin_session');
  cookieStore.set('rexermi_admin_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    expires: new Date(0),
    path: '/',
  });
}

// ─── Route Handler Helpers (read from NextRequest, write to NextResponse) ────

export async function verifyCustomerToken(req: NextRequest): Promise<UserSession | null> {
  const token = req.cookies.get('rexermi_session')?.value;
  if (!token) {
    const adminToken = req.cookies.get('rexermi_admin_session')?.value;
    if (adminToken) {
      const adminSession = await verifyToken<AdminSession>(adminToken);
      if (adminSession) {
        const adminUserRows = await dbQuery<{ id: number; username: string; email: string; full_name: string }[]>('SELECT id, username, email, full_name FROM admin_users WHERE id = ?', [adminSession.id]);
        const adminUser = adminUserRows[0];
        if (adminUser) {
          const userRows = await dbQuery<{ id: number; email: string; full_name: string; role: string }[]>('SELECT id, email, full_name, role FROM users WHERE email = ?', [adminUser.email]);
          let user = userRows[0];
          if (!user) {
            try {
              const info = await dbQuery("INSERT INTO users (full_name, email, password, role, is_active) VALUES (?, ?, 'ADMIN_AUTO', 'admin', 1)", [adminUser.full_name, adminUser.email]);
              user = { id: Number(info.insertId), email: adminUser.email, full_name: adminUser.full_name, role: 'admin' };
            } catch (e) {
              console.error('Failed to auto-create user for admin in verifyCustomerToken:', e);
            }
          }
          if (user) {
            return {
              id: user.id,
              email: user.email,
              fullName: user.full_name,
              role: 'admin'
            };
          }
        }
      }
    }
    return null;
  }
  return verifyToken<UserSession>(token);
}

export async function verifyAdminToken(req: NextRequest): Promise<AdminSession | null> {
  let token = req.cookies.get('rexermi_admin_session')?.value;
  if (!token) {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }
  if (!token) return null;
  return verifyToken<AdminSession>(token);
}

export async function setCustomerToken(response: NextResponse, session: UserSession): Promise<void> {
  const token = await createToken(session);
  response.cookies.set('rexermi_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 2, // 48h
    path: '/',
  });
}

export async function setAdminToken(response: NextResponse, session: AdminSession): Promise<void> {
  const token = await createToken(session, '24h');
  response.cookies.set('rexermi_admin_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 1, // 24h
    path: '/',
  });
}

// ─── Brute Force Protection (SQLite-Backed) ───────────────────────────────────

export async function checkLockout(key: string): Promise<{ locked: boolean; timeLeftSeconds: number }> {
  try {
    const rows = await dbQuery<{ attempts: number; lockout_until: number }[]>('SELECT attempts, lockout_until FROM login_attempts WHERE key = ?', [key]);
    const row = rows[0];
    if (!row) return { locked: false, timeLeftSeconds: 0 };
    
    if (row.attempts >= 5) {
      const now = Date.now();
      if (now < row.lockout_until) {
        return { locked: true, timeLeftSeconds: Math.ceil((row.lockout_until - now) / 1000) };
      } else {
        await dbQuery('DELETE FROM login_attempts WHERE key = ?', [key]);
      }
    }
  } catch (err) {
    console.error('Error checking lockout in SQLite:', err);
  }
  return { locked: false, timeLeftSeconds: 0 };
}

export async function recordFailedAttempt(key: string): Promise<number> {
  try {
    const rows = await dbQuery<{ attempts: number }[]>('SELECT attempts FROM login_attempts WHERE key = ?', [key]);
    const row = rows[0];
    const attempts = (row ? row.attempts : 0) + 1;
    const lockoutUntil = attempts >= 5 ? Date.now() + 15 * 60 * 1000 : 0;
    
    await dbQuery(`
      INSERT INTO login_attempts (key, attempts, lockout_until) 
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET attempts = excluded.attempts, lockout_until = excluded.lockout_until
    `, [key, attempts, lockoutUntil]);
    
    return attempts;
  } catch (err) {
    console.error('Error recording failed attempt in SQLite:', err);
    return 1;
  }
}

export async function resetAttempts(key: string): Promise<void> {
  try {
    await dbQuery('DELETE FROM login_attempts WHERE key = ?', [key]);
  } catch (err) {
    console.error('Error resetting attempts in SQLite:', err);
  }
}
