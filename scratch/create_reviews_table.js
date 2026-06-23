const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'src', 'data', 'database.sqlite');
console.log('Connecting to database at:', dbPath);

const db = new Database(dbPath);

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      order_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT,
      status TEXT NOT NULL DEFAULT 'approved' CHECK(status IN ('approved', 'hidden')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id, status);
    CREATE INDEX IF NOT EXISTS idx_product_reviews_order ON product_reviews(order_id);
  `);
  console.log('Table product_reviews created successfully!');
} catch (error) {
  console.error('Error creating table:', error);
} finally {
  db.close();
}
