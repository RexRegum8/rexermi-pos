const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const dbPath = path.join(process.cwd(), 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);

async function reset() {
  console.log("=== RESETTING PASSWORDS TO KNOWN DEFAULT VALUES ===");

  const saltAdmin = await bcrypt.genSalt(12);
  const hashAdmin = await bcrypt.hash('admin123', saltAdmin);
  
  const saltRuben = await bcrypt.genSalt(10);
  const hashRuben = await bcrypt.hash('ruben123', saltRuben);

  // Update admin user password
  const updateAdmin = db.prepare("UPDATE admin_users SET password = ? WHERE username = 'admin'").run(hashAdmin);
  console.log(`Updated admin password in admin_users: ${updateAdmin.changes} row(s) changed.`);

  // Update Ruben password
  const updateRuben = db.prepare("UPDATE users SET password = ? WHERE email = 'paezyanez23@gmail.com'").run(hashRuben);
  console.log(`Updated Ruben password in users: ${updateRuben.changes} row(s) changed.`);

  console.log("Verification checks:");
  const dbAdmin = db.prepare("SELECT username, password FROM admin_users WHERE username = 'admin'").get();
  console.log("Admin:", dbAdmin.username, "Hash starts with:", dbAdmin.password.substring(0, 7));
  
  const dbRuben = db.prepare("SELECT email, password FROM users WHERE email = 'paezyanez23@gmail.com'").get();
  console.log("Ruben:", dbRuben.email, "Hash starts with:", dbRuben.password.substring(0, 7));
}

reset().catch(console.error);
