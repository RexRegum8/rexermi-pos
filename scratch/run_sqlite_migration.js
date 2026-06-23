const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'src', 'data', 'database.sqlite');
console.log('Connecting to database at:', dbPath);

try {
  const db = new Database(dbPath);

  // Check if columns already exist
  const columnsInfo = db.prepare('PRAGMA table_info(products)').all();
  const columnNames = columnsInfo.map(col => col.name);

  db.transaction(() => {
    if (!columnNames.includes('es_subproducto')) {
      console.log('Adding column: es_subproducto');
      db.prepare('ALTER TABLE products ADD COLUMN es_subproducto INTEGER DEFAULT 0').run();
    } else {
      console.log('Column es_subproducto already exists.');
    }

    if (!columnNames.includes('id_producto_padre')) {
      console.log('Adding column: id_producto_padre');
      db.prepare('ALTER TABLE products ADD COLUMN id_producto_padre INTEGER DEFAULT NULL').run();
    } else {
      console.log('Column id_producto_padre already exists.');
    }

    if (!columnNames.includes('unidades_por_padre')) {
      console.log('Adding column: unidades_por_padre');
      db.prepare('ALTER TABLE products ADD COLUMN unidades_por_padre INTEGER DEFAULT NULL').run();
    } else {
      console.log('Column unidades_por_padre already exists.');
    }

    // Add index for id_producto_padre
    console.log('Creating index on id_producto_padre if not exists...');
    db.prepare('CREATE INDEX IF NOT EXISTS idx_products_id_producto_padre ON products(id_producto_padre)').run();
  })();

  console.log('Migration finished successfully!');
  db.close();
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
}
