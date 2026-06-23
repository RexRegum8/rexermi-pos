const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);

console.log("=== USER PASSWORD HASHES ===");
const users = db.prepare("SELECT email, password FROM users").all();
console.log(users);

console.log("=== ADMIN PASSWORD HASHES ===");
const admins = db.prepare("SELECT username, password FROM admin_users").all();
console.log(admins);
