import { dbQuery } from './db';

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
}

/**
 * Checks and updates rate limiting for a specific key using D1 / SQLite database.
 * Auto-prunes expired rate limits periodically.
 * 
 * @param key Unique key to identify client/action (e.g. "127.0.0.1:reviews")
 * @param limit Maximum number of requests allowed in window
 * @param windowMs Time window in milliseconds
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now();
  try {
    // Occasionally prune expired rate limits (10% chance per call to keep db clean)
    if (Math.random() < 0.1) {
      await dbQuery('DELETE FROM rate_limits WHERE reset_time < ?', [now]);
    }

    const rows = await dbQuery<{ count: number; reset_time: number }[]>(
      'SELECT count, reset_time FROM rate_limits WHERE key = ?',
      [key]
    );
    const row = rows[0];

    if (!row) {
      const resetTime = now + windowMs;
      await dbQuery(
        'INSERT INTO rate_limits (key, count, reset_time) VALUES (?, 1, ?)',
        [key, resetTime]
      );
      return { success: true, limit, remaining: limit - 1, resetTime };
    }

    if (now > row.reset_time) {
      const resetTime = now + windowMs;
      await dbQuery(
        'UPDATE rate_limits SET count = 1, reset_time = ? WHERE key = ?',
        [resetTime, key]
      );
      return { success: true, limit, remaining: limit - 1, resetTime };
    }

    if (row.count >= limit) {
      return { success: false, limit, remaining: 0, resetTime: row.reset_time };
    }

    await dbQuery('UPDATE rate_limits SET count = count + 1 WHERE key = ?', [key]);
    return { success: true, limit, remaining: limit - (row.count + 1), resetTime: row.reset_time };
  } catch (err) {
    console.error('Rate limit error:', err);
    // Safe fallback: let request through if rate limiting throws an error
    return { success: true, limit, remaining: limit, resetTime: now + windowMs };
  }
}
