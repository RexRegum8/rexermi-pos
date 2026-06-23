const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);

const defaultSettings = [
  { key: 'store_status_mode', value: 'manual', label: 'Modo de Operación', group: 'general' },
  { key: 'store_schedule_start', value: '08:00', label: 'Hora de Apertura', group: 'general' },
  { key: 'store_schedule_end', value: '18:00', label: 'Hora de Cierre', group: 'general' },
  { key: 'store_schedule_days', value: '1,2,3,4,5', label: 'Días de Operación', group: 'general' }
];

try {
  for (const s of defaultSettings) {
    const row = db.prepare('SELECT * FROM settings WHERE key = ?').get(s.key);
    if (!row) {
      db.prepare(`INSERT INTO settings (\`key\`, value, label, \`group\`) VALUES (?, ?, ?, ?)`).run(s.key, s.value, s.label, s.group);
      console.log(`✅ Initialized setting: ${s.key}`);
    } else {
      console.log(`ℹ️ Setting already exists: ${s.key} = ${row.value}`);
    }
  }
} catch (err) {
  console.error('Error initializing settings:', err);
} finally {
  db.close();
}
