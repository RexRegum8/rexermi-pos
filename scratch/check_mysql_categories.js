const mysql = require('mysql2/promise');

async function check() {
  try {
    const mysqlDb = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'rexermi_db'
    });
    const [rows] = await mysqlDb.query('SELECT * FROM categories');
    console.log('--- categories in MySQL ---');
    console.log(rows);
    await mysqlDb.end();
  } catch (err) {
    console.error('Error connecting to MySQL:', err.message);
  }
}

check();
