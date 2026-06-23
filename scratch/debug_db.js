const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);

console.log("=== PRODUCTS ===");
const products = db.prepare("SELECT id, name, stock, is_active FROM products").all();
console.log(products);

console.log("=== PENDING ORDERS ===");
const orders = db.prepare("SELECT id, order_number, status, total FROM orders WHERE status NOT IN ('delivered', 'cancelled')").all();
console.log(orders);

console.log("=== ORDER ITEMS ===");
const items = db.prepare(`
  SELECT oi.order_id, oi.product_id, oi.quantity, p.name 
  FROM order_items oi
  JOIN products p ON oi.product_id = p.id
`).all();
console.log(items);

db.close();
