const mysql = require('mysql2/promise');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const sqliteDir = path.join(__dirname, 'src', 'data');
  if (!fs.existsSync(sqliteDir)) {
    fs.mkdirSync(sqliteDir, { recursive: true });
  }
  
  const sqlitePath = path.join(sqliteDir, 'database.sqlite');
  if (fs.existsSync(sqlitePath)) {
    console.log('Borrando base de datos SQLite existente...');
    fs.unlinkSync(sqlitePath);
  }

  const sqliteDb = new Database(sqlitePath);

  // Connect to MySQL
  const mysqlDb = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'rexermi_db'
  });

  console.log('✅ Conectado a MySQL local.');

  const tables = [
    'settings', 'admin_users', 'users', 'categories', 
    'products', 'coupons', 'orders', 'order_items', 'product_images'
  ];

  for (const table of tables) {
    const [columns] = await mysqlDb.query(`SHOW COLUMNS FROM \`${table}\``);
    
    // Build CREATE TABLE statement dynamically
    let createTableSql = `CREATE TABLE \`${table}\` (\n`;
    const colDefs = columns.map(col => {
      let type = 'TEXT';
      const myType = col.Type.toLowerCase();
      if (myType.includes('int') || myType.includes('boolean') || myType.includes('tinyint')) type = 'INTEGER';
      if (myType.includes('decimal') || myType.includes('float') || myType.includes('double') || myType.includes('real')) type = 'REAL';
      
      let def = `  \`${col.Field}\` ${type}`;
      if (col.Key === 'PRI' && col.Extra === 'auto_increment') {
        def = `  \`${col.Field}\` INTEGER PRIMARY KEY AUTOINCREMENT`;
      }
      return def;
    });
    
    createTableSql += colDefs.join(',\n') + '\n);';
    sqliteDb.exec(createTableSql);
    console.log(`✅ Tabla ${table} creada.`);

    const [rows] = await mysqlDb.query(`SELECT * FROM \`${table}\``);
    if (rows.length === 0) {
      console.log(`- Tabla ${table}: 0 registros.`);
      continue;
    }

    // Get columns from the first row
    const cols = Object.keys(rows[0]);
    const placeholders = cols.map(() => '?').join(', ');
    const insertStmt = sqliteDb.prepare(`INSERT INTO \`${table}\` (\`${cols.join('`, `')}\`) VALUES (${placeholders})`);

    const insertMany = sqliteDb.transaction((rows) => {
      for (const row of rows) {
        // Convert dates/buffers if necessary
        const values = cols.map(col => {
          let val = row[col];
          if (val instanceof Date) {
            val = val.toISOString().slice(0, 19).replace('T', ' '); // YYYY-MM-DD HH:MM:SS
          }
          return val;
        });
        insertStmt.run(values);
      }
    });

    insertMany(rows);
    console.log(`- Tabla ${table}: ${rows.length} registros migrados.`);
  }

  await mysqlDb.end();
  sqliteDb.close();

  console.log('🚀 Migración a SQLite completada con éxito!');
}

migrate().catch(console.error);
