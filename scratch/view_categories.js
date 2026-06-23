const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);

try {
  const categories = db.prepare('SELECT * FROM categories').all();
  console.log('Categories in SQLite database:');
  console.log(categories);
} catch (err) {
  console.error('Error:', err);
}

db.close();
