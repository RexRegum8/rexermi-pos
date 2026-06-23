const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const dbPath = path.join(process.cwd(), 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);

async function resetVendedor1() {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash('vendedor123', salt);
  const result = db.prepare("UPDATE admin_users SET password = ? WHERE username = 'vendedor1'").run(hash);
  console.log(`Updated vendedor1 password: ${result.changes} row(s) changed.`);
}

resetVendedor1().catch(console.error);
