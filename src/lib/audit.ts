import { dbQuery } from './db';

/**
 * Logs an administrative action to the audit_logs table.
 * 
 * @param adminSession The admin session object from verifyAdminToken
 * @param action The title or name of the action performed
 * @param details Detailed description of the action
 */
export async function logAdminAction(
  adminSession: any,
  action: string,
  details: string = ''
): Promise<void> {
  try {
    const adminId = adminSession?.id || null;
    const adminEmail = adminSession?.username || adminSession?.email || 'admin@rexermi.local';

    await dbQuery(
      'INSERT INTO audit_logs (admin_id, admin_email, action, details) VALUES (?, ?, ?, ?)',
      [adminId, adminEmail, action, details]
    );
  } catch (error) {
    console.error('Failed to log admin action:', error);
  }
}
