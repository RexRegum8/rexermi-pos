const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);

try {
  const row = db.prepare("SELECT * FROM settings WHERE key = 'commission_rate'").get();
  if (!row) {
    db.prepare(`
      INSERT INTO settings (key, value, label, \`group\`)
      VALUES ('commission_rate', '5.0', 'Porcentaje de Comisión de Ventas (%)', 'general')
    `).run();
    console.log("Setting commission_rate added successfully with default value 5.0.");
  } else {
    console.log("Setting commission_rate already exists.");
  }
} catch (err) {
  console.error("Migration error:", err);
} finally {
  db.close();
}
