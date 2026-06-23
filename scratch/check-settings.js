const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);
const rows = db.prepare("SELECT * FROM settings WHERE `key` = 'dollar_rate'").all();
console.log(rows);
db.close();
