import { dbSchemaSql } from './dbSchema';
import { getRequestContext } from '@cloudflare/next-on-pages';

const isEdge = typeof EdgeRuntime === 'string';

let dbPath = '';
let backupDir = '';
let safeBackupPath = '';
let path: any = null;
let fs: any = null;
let os: any = null;

if (!isEdge) {
  const requireFunc = typeof __webpack_require__ === "function" ? __non_webpack_require__ : require;
  path = requireFunc('path');
  fs = requireFunc('fs');
  os = requireFunc('os');
  
  dbPath = process.env.DATABASE_PATH || path.join(process['cwd'](), 'src', 'data', 'database.sqlite');
  backupDir = process.env.BACKUP_DIR || path.join(os.homedir(), '.rexermi');
  safeBackupPath = path.join(backupDir, 'db_backup_safe.sqlite');
}



// Declare a global or module-scoped connection for local better-sqlite3
let localDbConnection: any = null;

function getLocalConnection() {
  if (localDbConnection) return localDbConnection;

  if (isEdge) {
    throw new Error("Cannot open better-sqlite3 connection in Edge/Cloudflare environment.");
  }

  // Dynamically require better-sqlite3 to prevent Edge bundler crashes
  const requireFunc = typeof __webpack_require__ === "function" ? __non_webpack_require__ : require;
  const Database = requireFunc('better-sqlite3');

  const connection = new Database(dbPath);
  connection.pragma('journal_mode = WAL');
  connection.pragma('foreign_keys = ON');

  // Create critical indexes for query performance (local only)
  try {
    connection.exec(`
      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active, is_featured);
      CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON inventory_movements(product_id);
      
      -- Recommended Indexes for performance optimization
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
      CREATE INDEX IF NOT EXISTS idx_orders_cash_closure ON orders(cash_closure_id);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_id_document ON users(id_document);
      CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
      CREATE INDEX IF NOT EXISTS idx_cash_closures_user ON cash_closures(user_id);
      CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
      
      CREATE TABLE IF NOT EXISTS product_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        order_id INTEGER NOT NULL,
        rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
        comment TEXT,
        status TEXT NOT NULL DEFAULT 'approved' CHECK(status IN ('approved', 'hidden')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id, status);
      CREATE INDEX IF NOT EXISTS idx_product_reviews_order ON product_reviews(order_id);

      -- Create new tables for suppliers and purchases
      CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        contact_name TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS purchase_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'received', 'cancelled')),
        total_cost REAL NOT NULL DEFAULT 0.0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        received_at TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_order_id INTEGER NOT NULL,
        product_id INTEGER,
        product_name TEXT NOT NULL,
        cost_price REAL NOT NULL DEFAULT 0.0,
        quantity INTEGER NOT NULL,
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS login_attempts (
        key TEXT PRIMARY KEY,
        attempts INTEGER NOT NULL DEFAULT 0,
        lockout_until INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS revoked_tokens (
        token TEXT PRIMARY KEY,
        revoked_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_credits (
        user_id INTEGER PRIMARY KEY,
        credit_limit REAL NOT NULL DEFAULT 0.0,
        credit_used REAL NOT NULL DEFAULT 0.0,
        loyalty_points INTEGER NOT NULL DEFAULT 0,
        credit_status TEXT NOT NULL DEFAULT 'active' CHECK(credit_status IN ('active', 'suspended', 'cancelled')),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS credit_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
        admin_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS credit_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        amount_change REAL NOT NULL,
        movement_type TEXT NOT NULL CHECK(movement_type IN ('purchase', 'payment', 'adjustment')),
        reference_id TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS loyalty_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        points_change INTEGER NOT NULL,
        reason TEXT NOT NULL,
        reference_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id INTEGER,
        admin_email TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL,
        reset_time INTEGER NOT NULL
      );
    `);

    // Alter products to add columns if not exists
    const columns = connection.pragma("table_info(products)") as any[];
    if (!columns.some(col => col.name === 'supplier_id')) {
      connection.exec("ALTER TABLE products ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL;");
    }
    if (!columns.some(col => col.name === 'purchase_url')) {
      connection.exec("ALTER TABLE products ADD COLUMN purchase_url TEXT;");
    }
    if (!columns.some(col => col.name === 'barcode')) {
      connection.exec("ALTER TABLE products ADD COLUMN barcode TEXT;");
      connection.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);");
    }
    if (!columns.some(col => col.name === 'price_type')) {
      connection.exec("ALTER TABLE products ADD COLUMN price_type TEXT DEFAULT 'fixed';");
    }
    if (!columns.some(col => col.name === 'price_max')) {
      connection.exec("ALTER TABLE products ADD COLUMN price_max REAL DEFAULT NULL;");
    }

    // Alter credit_history columns if not exists
    const creditCols = connection.pragma("table_info(credit_history)") as any[];
    if (!creditCols.some(col => col.name === 'cash_closure_id')) {
      connection.exec("ALTER TABLE credit_history ADD COLUMN cash_closure_id INTEGER REFERENCES cash_closures(id) ON DELETE SET NULL;");
    }
    if (!creditCols.some(col => col.name === 'payment_method')) {
      connection.exec("ALTER TABLE credit_history ADD COLUMN payment_method TEXT;");
    }

    // Alter users columns if not exists
    const userCols = connection.pragma("table_info(users)") as any[];
    if (!userCols.some(col => col.name === 'pin')) {
      connection.exec("ALTER TABLE users ADD COLUMN pin TEXT;");
    }
  } catch (error) {
    console.warn('Local SQLite DB initialization failed/partially bypassed:', error);
  }

  localDbConnection = connection;
  return connection;
}

// Safe backup copy to User OS Home directory (Local mode only)
export function copyToSafeLocation() {
  if (isEdge) return;
  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, safeBackupPath);
      console.log('Database backed up to safe OS location:', safeBackupPath);
    }
  } catch (err) {
    console.error('Failed to copy database to safe location:', err);
  }
}

// Restore backup from User OS Home directory (Local mode only)
export function restoreFromSafeLocation(): boolean {
  if (isEdge) return false;
  try {
    if (fs.existsSync(safeBackupPath)) {
      const destDir = path.dirname(dbPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(safeBackupPath, dbPath);
      console.log('Database restored from safe OS location.');
      return true;
    }
    return false;
  } catch (err) {
    console.error('Failed to restore database from safe location:', err);
    return false;
  }
}

// Initialize a new empty database with full schemas and settings (Local mode only)
export function initNewDatabaseSchema(): boolean {
  if (isEdge) return false;
  try {
    const conn = getLocalConnection();
    conn.exec(dbSchemaSql);
    console.log('New database schema initialized successfully.');
    return true;
  } catch (err) {
    console.error('Failed to initialize database schema:', err);
    return false;
  }
}

export function reinitializeDatabase() {
  if (isEdge) return;
  if (localDbConnection) {
    try {
      localDbConnection.close();
    } catch {}
  }
  localDbConnection = null;
  getLocalConnection();
}

// Core Async Query Wrapper (Works on both Local SQLite and Cloudflare D1)
export async function dbQuery<T = any>(sql: string, params?: any[]): Promise<T> {
  if (!isEdge) {
    // Local SQLite database (better-sqlite3)
    const conn = getLocalConnection();
    try {
      const stmt = conn.prepare(sql);
      const isSelect = sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('WITH');
      if (isSelect) {
        return stmt.all(params || []) as T;
      } else {
        const info = stmt.run(params || []);
        return {
          insertId: info.lastInsertRowid,
          affectedRows: info.changes,
        } as T;
      }
    } catch (error) {
      console.error('SQLite Local Error:', error);
      throw error;
    }
  } else {
    // Cloudflare D1 database (Production)
    try {
      let env: any;
      try {
        env = getRequestContext()?.env;
      } catch {}

      const d1Db = env?.DB;
      if (!d1Db) {
        // Fallback / Mock connection during Next.js static build compilation phase
        const isSelect = sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('WITH');
        return (isSelect ? [] : { insertId: 0, affectedRows: 0 }) as unknown as T;
      }

      const isSelect = sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('WITH');
      const stmt = d1Db.prepare(sql);
      const boundStmt = params && params.length > 0 ? stmt.bind(...params) : stmt;

      if (isSelect) {
        const { results } = await boundStmt.all();
        return results as T;
      } else {
        const info = await boundStmt.run();
        return {
          insertId: info.meta.last_row_id ?? info.meta.lastInsertRowid ?? 0,
          affectedRows: info.meta.changes ?? 0,
        } as T;
      }
    } catch (error) {
      console.error('Cloudflare D1 Query Error:', error);
      throw error;
    }
  }
}

// Core Async Batch Transaction Wrapper (Works on both Local SQLite and Cloudflare D1)
export async function dbBatch(queries: { sql: string; params?: any[] }[]): Promise<any[]> {
  if (queries.length === 0) return [];

  if (!isEdge) {
    // Local SQLite transaction
    const conn = getLocalConnection();
    const runBatch = conn.transaction((qList: typeof queries) => {
      const results: any[] = [];
      for (const q of qList) {
        const stmt = conn.prepare(q.sql);
        const isSelect = q.sql.trim().toUpperCase().startsWith('SELECT') || q.sql.trim().toUpperCase().startsWith('WITH');
        if (isSelect) {
          results.push(stmt.all(q.params || []));
        } else {
          const info = stmt.run(q.params || []);
          results.push({
            insertId: info.lastInsertRowid,
            affectedRows: info.changes
          });
        }
      }
      return results;
    });
    return runBatch(queries);
  } else {
    // Cloudflare D1 batch transaction
    try {
      let env: any;
      try {
        env = getRequestContext()?.env;
      } catch {}

      const d1Db = env?.DB;
      if (!d1Db) {
        return queries.map(q => {
          const isSelect = q.sql.trim().toUpperCase().startsWith('SELECT') || q.sql.trim().toUpperCase().startsWith('WITH');
          return isSelect ? [] : { insertId: 0, affectedRows: 0 };
        });
      }

      const d1PreparedStmts = queries.map(q => {
        const stmt = d1Db.prepare(q.sql);
        return q.params && q.params.length > 0 ? stmt.bind(...q.params) : stmt;
      });

      const batchResults = await d1Db.batch(d1PreparedStmts);
      return batchResults.map((res: any, idx: number) => {
        const isSelect = queries[idx].sql.trim().toUpperCase().startsWith('SELECT') || queries[idx].sql.trim().toUpperCase().startsWith('WITH');
        if (isSelect) {
          return res.results;
        } else {
          return {
            insertId: res.meta.last_row_id ?? res.meta.lastInsertRowid ?? 0,
            affectedRows: res.meta.changes ?? 0
          };
        }
      });
    } catch (error) {
      console.error('Cloudflare D1 Batch Error:', error);
      throw error;
    }
  }
}

// Proxy Object for backwards compatibility to prevent crashes during Edge compilation
const db = new Proxy({}, {
  get(target, prop) {
    if (isEdge) {
      throw new Error(`Direct synchronous 'db' access (${String(prop)}) is not allowed in Edge/Cloudflare environment. Use 'dbQuery' or 'dbBatch' instead.`);
    }
    return getLocalConnection()[prop];
  }
});

// Run local safe backup on startup if in node/dev
if (!isEdge && process.env.NODE_ENV !== 'production') {
  setTimeout(() => {
    copyToSafeLocation();
  }, 5000);
}

export default db;
