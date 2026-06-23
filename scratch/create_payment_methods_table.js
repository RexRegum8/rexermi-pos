const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);

try {
  // Create table
  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      details TEXT NOT NULL,
      requires_proof INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1
    );
  `);
  console.log('✅ Created table payment_methods if not existed.');

  // Check if empty
  const count = db.prepare('SELECT COUNT(*) as count FROM payment_methods').get().count;
  if (count === 0) {
    const insert = db.prepare(`
      INSERT INTO payment_methods (name, type, category, details, requires_proof, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Fetch existing values from settings if possible to migrate them
    const zoomRow = db.prepare("SELECT value FROM settings WHERE key = 'payment_zoom'").get();
    const bankRow = db.prepare("SELECT value FROM settings WHERE key = 'payment_bank'").get();
    const binanceRow = db.prepare("SELECT value FROM settings WHERE key = 'payment_binance'").get();
    const otherRow = db.prepare("SELECT value FROM settings WHERE key = 'payment_other'").get();

    const zoomVal = zoomRow?.value || '04123735830 / 30655967 / 0102';
    const bankVal = bankRow?.value || '';
    const binanceVal = binanceRow?.value || '';
    const otherVal = otherRow?.value || '';

    // Parse zoomVal (usually phone / doc / bank)
    const zoomParts = zoomVal.split('/');
    const phone = zoomParts[0]?.trim() || '04123735830';
    const doc = zoomParts[1]?.trim() || '30655967';
    const bank = zoomParts[2]?.trim() || '0102';

    // Insert Pago Móvil
    insert.run(
      'Zoom / Pago Móvil',
      'online',
      'mobile_payment',
      JSON.stringify({ phone, id_document: doc, bank_name: bank }),
      1,
      1
    );

    // Insert Transferencia Bancaria
    insert.run(
      'Transferencia Bancaria',
      'online',
      'bank',
      JSON.stringify({ bank_name: 'Banco de Venezuela', account_number: bankVal || 'Coordinar transferencia bancaria', id_document: doc, owner_name: 'Titular' }),
      1,
      1
    );

    // Insert Binance
    insert.run(
      'Binance Pay / Cripto',
      'online',
      'wallet',
      JSON.stringify({ wallet_name: 'Binance', email: binanceVal || 'jdlvanonymous@gmail.com', pay_id: '' }),
      1,
      1
    );

    // Insert Efectivo
    insert.run(
      'Efectivo',
      'physical',
      'cash',
      JSON.stringify({ instructions: otherVal || 'Coordinar entrega de efectivo' }),
      0,
      1
    );

    console.log('✅ Populated table payment_methods with default values.');
  } else {
    console.log('ℹ️ Table payment_methods already populated.');
  }
} catch (err) {
  console.error('Error during database migration:', err);
} finally {
  db.close();
}
