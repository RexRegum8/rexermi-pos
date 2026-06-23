const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);

const productCounts = db.prepare(`
  SELECT c.id, c.name, c.is_active, COUNT(p.id) as total_products, COUNT(CASE WHEN p.is_active = 1 THEN 1 END) as active_products
  FROM categories c
  LEFT JOIN products p ON p.category_id = c.id
  GROUP BY c.id
`).all();

console.log('--- category product counts ---');
console.log(productCounts);

db.close();
