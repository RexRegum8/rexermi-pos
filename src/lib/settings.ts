import { dbQuery } from './db';

export async function getSettings(): Promise<Record<string, string>> {
  try {
    // GROUP BY key ensures we never return duplicate keys even if the DB has them
    const rows = await dbQuery<{ key: string; value: string }[]>(
      'SELECT `key`, `value` FROM settings GROUP BY `key` ORDER BY rowid DESC'
    );
    const settings: Record<string, string> = {};
    if (Array.isArray(rows)) {
      rows.forEach((row) => {
        settings[row.key] = row.value;
      });
    }
    return settings;
  } catch (error) {
    console.error('Error fetching settings from database:', error);
    return {};
  }
}

export async function getSetting(key: string, defaultValue: string = ''): Promise<string> {
  const settings = await getSettings();
  return settings[key] ?? defaultValue;
}

export function isStoreOpen(settings: Record<string, string>): boolean {
  const mode = settings['store_status_mode'] || 'manual';
  if (mode === 'manual') {
    return settings['store_open'] !== '0';
  }

  // Scheduled mode
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const allowedDays = (settings['store_schedule_days'] || '').split(',').map(Number);

  if (!allowedDays.includes(currentDay)) {
    return false;
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const startStr = settings['store_schedule_start'] || '08:00';
  const endStr = settings['store_schedule_end'] || '18:00';
  const [startH, startM] = startStr.split(':').map(Number);
  const [endH, endM] = endStr.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (endMinutes < startMinutes) {
    // Overnight schedule (e.g., 22:00 to 06:00)
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

export function isCreditAvailable(settings: Record<string, string>): boolean {
  if (settings['credit_enabled'] !== '1') {
    return false;
  }

  const mode = settings['credit_schedule_mode'] || 'always';
  if (mode === 'always') {
    return true;
  }

  const now = new Date();

  // 1. Season/Date range validation if mode is 'dates' or 'mixed'
  if (mode === 'dates' || mode === 'mixed') {
    const seasonStart = settings['credit_season_start'];
    const seasonEnd = settings['credit_season_end'];
    if (seasonStart && seasonEnd) {
      const start = new Date(seasonStart + 'T00:00:00');
      const end = new Date(seasonEnd + 'T23:59:59');
      if (now < start || now > end) {
        return false;
      }
    }
  }

  // 2. Weekly days and Hours range validation if mode is 'hours' or 'mixed'
  if (mode === 'hours' || mode === 'mixed') {
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const allowedDays = (settings['credit_schedule_days'] || '').split(',').filter(Boolean).map(Number);
    if (allowedDays.length > 0 && !allowedDays.includes(currentDay)) {
      return false;
    }

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startStr = settings['credit_schedule_start'] || '08:00';
    const endStr = settings['credit_schedule_end'] || '18:00';
    const [startH, startM] = startStr.split(':').map(Number);
    const [endH, endM] = endStr.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (endMinutes < startMinutes) {
      // Overnight
      if (currentMinutes < startMinutes && currentMinutes > endMinutes) {
        return false;
      }
    } else {
      if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
        return false;
      }
    }
  }

  return true;
}

