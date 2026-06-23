const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);

console.log('Database path:', dbPath);
try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables in database:');
  console.log(tables);
  
  // Inspect schema of product_images if it exists
  const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='product_images'").all();
  console.log('product_images schema:', schema);
} catch (err) {
  console.error('Error:', err);
}
db.close();
