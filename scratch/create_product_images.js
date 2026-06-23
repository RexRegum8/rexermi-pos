const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'src', 'data', 'database.sqlite');
console.log('Connecting to database at:', dbPath);

try {
  const db = new Database(dbPath);

  console.log('Creating product_images table if it does not exist...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  console.log('Creating index on product_images(product_id) if not exists...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
  `);

  console.log('Table and index created successfully!');
  db.close();
} catch (error) {
  console.error('Failed to create table:', error);
  process.exit(1);
}
