const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);

console.log('--- Checking products for null/invalid prices ---');
try {
  const nullPriceProducts = db.prepare('SELECT id, name, price, stock, is_active FROM products WHERE price IS NULL').all();
  console.log(`Found ${nullPriceProducts.length} products with NULL price:`);
  console.log(JSON.stringify(nullPriceProducts, null, 2));

  const allProducts = db.prepare('SELECT id, name, price, stock, is_active FROM products LIMIT 10').all();
  console.log('\nSample products from database:');
  console.log(JSON.stringify(allProducts, null, 2));
} catch (err) {
  console.error('Error querying database:', err);
}
