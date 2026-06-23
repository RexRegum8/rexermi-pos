const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);

console.log("=== TABLES IN DB ===");
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log(tables);

for (const t of tables) {
  console.log(`\n=== SCHEMA FOR TABLE ${t.name} ===`);
  const schema = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(t.name);
  console.log(schema.sql);
}
