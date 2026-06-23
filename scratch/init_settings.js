const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);

try {
  const row = db.prepare('SELECT * FROM settings WHERE key = ?').get('store_open');
  if (!row) {
    db.prepare(`INSERT INTO settings (\`key\`, value, label, \`group\`) VALUES ('store_open', '1', 'Estado de la Tienda', 'general')`).run();
    console.log('✅ Initialized store_open setting successfully.');
  } else {
    console.log('ℹ️ store_open setting already exists:', row);
  }
} catch (err) {
  console.error('Error initializing settings:', err);
} finally {
  db.close();
}
