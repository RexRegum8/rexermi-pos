const mysql = require('mysql2/promise');
const Database = require('better-sqlite3');
const path = require('path');

async function main() {
  const dbPath = path.join(__dirname, '..', 'src', 'data', 'database.sqlite');
  console.log('SQLite Database:', dbPath);
  const sqliteDb = new Database(dbPath);

  try {
    const sqliteTables = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('SQLite Tables:', sqliteTables.map(t => t.name));
    for (const t of sqliteTables) {
      if (t.name === 'sqlite_sequence') continue;
      const count = sqliteDb.prepare(`SELECT count(*) as count FROM \`${t.name}\``).get().count;
      console.log(`  - SQLite table ${t.name}: ${count} rows`);
    }
  } catch (err) {
    console.error('Error reading SQLite:', err);
  }

  console.log('\nConnecting to MySQL...');
  try {
    const mysqlDb = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'rexermi_db'
    });
    console.log('MySQL connected!');
    const [tables] = await mysqlDb.query('SHOW TABLES');
    console.log('MySQL Tables:', tables);
    for (const row of tables) {
      const tableName = Object.values(row)[0];
      const [rows] = await mysqlDb.query(`SELECT count(*) as count FROM \`${tableName}\``);
      console.log(`  - MySQL table ${tableName}: ${rows[0].count} rows`);
    }
    await mysqlDb.end();
  } catch (err) {
    console.log('Could not connect to MySQL:', err.message);
  }
  sqliteDb.close();
}

main().catch(console.error);
