const Database = require('better-sqlite3');
const db = new Database('src/data/database.sqlite');

// Check all duplicate keys in settings
const dupes = db.prepare(`
  SELECT key, COUNT(*) as cnt, GROUP_CONCAT(rowid) as rowids
  FROM settings
  GROUP BY key
  HAVING cnt > 1
`).all();

console.log('Duplicate keys found:', JSON.stringify(dupes, null, 2));

// Show all maintenance rows
const maintenance = db.prepare(`SELECT rowid, * FROM settings WHERE key LIKE '%maintenance%'`).all();
console.log('Maintenance rows:', JSON.stringify(maintenance, null, 2));

// Fix: for each duplicate key, keep the one with the highest rowid (most recent), delete the rest
for (const dupe of dupes) {
  const rowids = dupe.rowids.split(',').map(Number).sort((a, b) => a - b);
  const toDelete = rowids.slice(0, -1); // keep last, delete the rest
  for (const rowid of toDelete) {
    db.prepare('DELETE FROM settings WHERE rowid = ?').run(rowid);
    console.log(`Deleted duplicate settings row ${rowid} for key: ${dupe.key}`);
  }
}

// Verify
const remaining = db.prepare(`SELECT rowid, * FROM settings WHERE key LIKE '%maintenance%'`).all();
console.log('Remaining maintenance rows after fix:', JSON.stringify(remaining, null, 2));

db.close();
console.log('Done.');
