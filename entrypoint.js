const fs = require('fs');
const path = require('path');

const srcDb = path.join(__dirname, 'src', 'data', 'database.sqlite');
const destDb = process.env.DATABASE_PATH || '/data/database.sqlite';

console.log('Checking database status...');
if (!fs.existsSync(destDb)) {
  console.log(`Database not found at "${destDb}". Seeding initial database from "${srcDb}"...`);
  try {
    const destDir = path.dirname(destDb);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    if (fs.existsSync(srcDb)) {
      fs.copyFileSync(srcDb, destDb);
      console.log('Database seeded successfully.');
    } else {
      console.warn('⚠️ Warning: Initial source database not found at', srcDb);
    }
  } catch (err) {
    console.error('❌ Failed to seed SQLite database:', err);
  }
} else {
  console.log(`Database already exists at "${destDb}". Skipping seed.`);
}

// Start the Next.js standalone server
console.log('Starting Next.js production server...');
require('./server.js');
