const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);

console.log("=== USERS ===");
console.log(db.prepare("SELECT id, full_name, email, role FROM users").all());

console.log("\n=== ORDERS ===");
console.log(db.prepare("SELECT id, order_number, user_id, status FROM orders").all());

console.log("\n=== CASH CLOSURES ===");
console.log(db.prepare("SELECT id, user_id, status, opening_amount, expected_amount FROM cash_closures").all());
