const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const dbPath = path.join(process.cwd(), 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);

async function testLogin() {
  // 1. Admin login test
  const admin = db.prepare("SELECT password FROM admin_users WHERE username = 'admin'").get();
  const pwdToCheck = admin.password.replace(/^\$2y\$/, '$2a$').replace(/^\$2b\$/, '$2a$');
  const isValidAdmin = await bcrypt.compare('admin123', pwdToCheck);
  console.log("Admin login ('admin123'):", isValidAdmin);

  // 2. Ruben login test
  const ruben = db.prepare("SELECT password FROM users WHERE email = 'paezyanez23@gmail.com'").get();
  const normalizedHash = ruben.password.replace(/^\$2[yb]\$/, '$2a$');
  const isValidRuben = await bcrypt.compare('ruben123', normalizedHash);
  console.log("Ruben login ('ruben123'):", isValidRuben);
}

testLogin().catch(console.error);
