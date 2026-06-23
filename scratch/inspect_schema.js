const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);

console.log('--- orders schema ---');
console.log(db.prepare("PRAGMA table_info(orders)").all());

console.log('--- order_items schema ---');
console.log(db.prepare("PRAGMA table_info(order_items)").all());

db.close();
