const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'src', 'data', 'database.sqlite');
console.log('Connecting to database at:', dbPath);

try {
  const db = new Database(dbPath);

  console.log('Creating chat_messages table if it does not exist...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      sender_role TEXT NOT NULL CHECK(sender_role IN ('user', 'admin')),
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  
  console.log('Creating index on chat_messages(user_id) if not exists...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
  `);

  console.log('Creating index on chat_messages(is_read) if not exists...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_unread ON chat_messages(is_read) WHERE is_read = 0;
  `);

  console.log('Table and indexes created successfully!');
  db.close();
} catch (error) {
  console.error('Failed to create chat_messages table:', error);
  process.exit(1);
}
