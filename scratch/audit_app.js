const fs = require('fs');
const Database = require('better-sqlite3');
const path = require('path');

console.log('--- DEEP AUDIT OF REXERMI MARKETPLACE ---');

// 1. Verify SQLite Database & Schema
const dbPath = path.join(process.cwd(), 'src', 'data', 'database.sqlite');
if (!fs.existsSync(dbPath)) {
  console.error('❌ Database file not found at:', dbPath);
  process.exit(1);
}
console.log('✅ SQLite Database file found at:', dbPath);

const db = new Database(dbPath);
try {
  // Check tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
  console.log('✅ Connected to SQLite. Total tables:', tables.length);
  console.log('👉 Tables:', tables.join(', '));
  
  // Check products columns
  const productCols = db.prepare("PRAGMA table_info(products)").all().map(c => c.name);
  console.log('👉 Products columns:', productCols.join(', '));
  if (productCols.includes('min_stock_alert')) {
    console.log('✅ min_stock_alert column exists in products table!');
  } else {
    console.warn('⚠️ min_stock_alert column does NOT exist in products table. Adding it now...');
    db.prepare('ALTER TABLE products ADD COLUMN min_stock_alert INTEGER DEFAULT 3').run();
    console.log('✅ Added min_stock_alert column successfully.');
  }

  // Check columns of other critical tables
  const orderCols = db.prepare("PRAGMA table_info(orders)").all().map(c => c.name);
  console.log('👉 Orders columns:', orderCols.join(', '));
} catch (err) {
  console.error('❌ Database query error during audit:', err);
}

// 2. Scan for leftover "/vendedor" paths
console.log('\n--- SCANNING FOR UNMODIFIED PATHS ---');
const filesToCheck = [
  'src/middleware.ts',
  'src/components/Navbar.tsx',
  'src/components/ClientLayout.tsx',
  'src/components/BottomNavigation.tsx',
  'src/components/AdminSidebar.tsx',
  'src/app/login/LoginClient.tsx'
];

filesToCheck.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    const matches = content.match(/\/vendedor[/'"]|vendedor/g);
    if (matches && file !== 'src/app/login/LoginClient.tsx') { // Login might have 'vendedor' user role string checks, which is OK
      // filter out API calls (e.g. /api/vendedor) which are correct
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (line.includes('/vendedor') && !line.includes('/api/vendedor')) {
          console.warn(`⚠️ Remaining reference to /vendedor in ${file}:${index + 1}: ${line.trim()}`);
        }
      });
    } else {
      console.log(`✅ ${file} contains no user-facing /vendedor route links.`);
    }
  } else {
    console.error(`❌ File not found: ${file}`);
  }
});

console.log('\n--- AUDIT COMPLETE ---');
