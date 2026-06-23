const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);

console.log("=== ALL SETTINGS ===");
const settings = db.prepare("SELECT * FROM settings").all();
console.log(settings);
