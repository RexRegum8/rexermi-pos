const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);

console.log('Running cash closures migration...');
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cash_closures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      opening_amount REAL NOT NULL,
      expected_amount REAL DEFAULT 0.0,
      actual_amount REAL,
      notes TEXT,
      status TEXT DEFAULT 'open',
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);
  console.log('Created cash_closures table.');
} catch (e) {
  console.error('Error creating cash_closures table:', e);
}

try {
  // Check if cash_closure_id column exists in orders table
  const tableInfo = db.pragma('table_info(orders)');
  const columnExists = tableInfo.some(col => col.name === 'cash_closure_id');
  if (!columnExists) {
    db.exec(`ALTER TABLE orders ADD COLUMN cash_closure_id INTEGER REFERENCES cash_closures(id);`);
    console.log('Added cash_closure_id column to orders table.');
  } else {
    console.log('cash_closure_id column already exists in orders table.');
  }
} catch (e) {
  console.error('Error adding column to orders table:', e);
}

console.log('Migration finished.');
db.close();
