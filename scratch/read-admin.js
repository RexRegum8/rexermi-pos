const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);
const admins = db.prepare('SELECT id, username, role FROM admin_users').all();
console.log("Admin users in admin_users:", admins);
const users = db.prepare("SELECT id, email, role, is_active FROM users WHERE role='admin' OR role='custom'").all();
console.log("Admins/custom users in users table:", users);
db.close();
