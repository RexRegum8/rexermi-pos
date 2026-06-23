const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);

try {
  // Check if dollar_rate already exists
  const row = db.prepare("SELECT * FROM settings WHERE key = 'dollar_rate'").get();
  if (!row) {
    db.prepare(`
      INSERT INTO settings (key, value, label, \`group\`)
      VALUES ('dollar_rate', '40.0', 'Tasa de cambio (Bs. / USD)', 'general')
    `).run();
    console.log("Setting dollar_rate added successfully with default value 40.0.");
  } else {
    console.log("Setting dollar_rate already exists.");
  }
} catch (err) {
  console.error("Migration error:", err);
} finally {
  db.close();
}
