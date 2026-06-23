const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);

console.log("=== ADMIN USERS ===");
console.log(db.prepare("SELECT id, username, full_name, email, role FROM admin_users").all());

console.log("=== USERS ===");
console.log(db.prepare("SELECT id, full_name, email, role, is_active FROM users").all());
