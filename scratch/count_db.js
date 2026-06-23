const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);

console.log("=== DATABASE COUNTS ===");
const tables = ['users', 'orders', 'order_items', 'cash_closures', 'inventory_movements', 'product_reviews', 'chat_messages'];
for (const t of tables) {
  try {
    const count = db.prepare(`SELECT count(*) as count FROM ${t}`).get().count;
    console.log(`${t}: ${count} rows`);
  } catch (e) {
    console.log(`${t}: table does not exist or error: ${e.message}`);
  }
}
