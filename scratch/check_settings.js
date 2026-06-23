const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);

console.log('--- Current Settings in DB ---');
try {
  const settings = db.prepare('SELECT id, key, value, label, `group` FROM settings').all();
  console.log(JSON.stringify(settings, null, 2));
} catch (err) {
  console.error('Error querying settings:', err);
}
db.close();
