const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);

const categories = db.prepare("SELECT * FROM categories").all();
console.log('--- categories in database ---');
console.log(categories);

db.close();
