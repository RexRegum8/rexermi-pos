// Database Schema SQL script for initialization
export const dbSchemaSql = `-- DATABASE SCHEMA INITIALIZATION --

CREATE TABLE \`settings\` (
  \`id\` INTEGER PRIMARY KEY AUTOINCREMENT,
  \`key\` TEXT,
  \`value\` TEXT,
  \`label\` TEXT,
  \`group\` TEXT
);

CREATE TABLE \`admin_users\` (
  \`id\` INTEGER PRIMARY KEY AUTOINCREMENT,
  \`username\` TEXT,
  \`password\` TEXT,
  \`full_name\` TEXT,
  \`email\` TEXT,
  \`created_at\` TEXT
, role TEXT DEFAULT 'admin');

CREATE TABLE \`users\` (
  \`id\` INTEGER PRIMARY KEY AUTOINCREMENT,
  \`full_name\` TEXT,
  \`email\` TEXT,
  \`password\` TEXT,
  \`phone\` TEXT,
  \`id_document\` TEXT,
  \`address\` TEXT,
  \`city\` TEXT,
  \`state\` TEXT,
  \`country\` TEXT,
  \`postal_code\` TEXT,
  \`notes\` TEXT,
  \`is_active\` INTEGER,
  \`created_at\` TEXT,
  \`updated_at\` TEXT
, role TEXT DEFAULT 'user', permissions TEXT DEFAULT NULL, pin TEXT DEFAULT NULL);

CREATE TABLE \`categories\` (
  \`id\` INTEGER PRIMARY KEY AUTOINCREMENT,
  \`name\` TEXT,
  \`slug\` TEXT,
  \`description\` TEXT,
  \`icon\` TEXT,
  \`is_active\` INTEGER,
  \`sort_order\` INTEGER,
  \`created_at\` TEXT
);

CREATE TABLE \`products\` (
  \`id\` INTEGER PRIMARY KEY AUTOINCREMENT,
  \`category_id\` INTEGER,
  \`name\` TEXT,
  \`slug\` TEXT,
  \`short_desc\` TEXT,
  \`description\` TEXT,
  \`price\` REAL,
  \`stock\` INTEGER,
  \`type\` TEXT,
  \`image\` TEXT,
  \`image2\` TEXT,
  \`image3\` TEXT,
  \`is_featured\` INTEGER,
  \`is_active\` INTEGER,
  \`views\` INTEGER,
  \`created_at\` TEXT,
  \`updated_at\` TEXT
, es_subproducto INTEGER DEFAULT 0, id_producto_padre INTEGER DEFAULT NULL, unidades_por_padre INTEGER DEFAULT NULL, supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL, purchase_url TEXT, barcode TEXT, min_stock_alert INTEGER DEFAULT 3, price_type TEXT DEFAULT 'fixed', price_max REAL DEFAULT NULL);

CREATE TABLE \`coupons\` (
  \`id\` INTEGER PRIMARY KEY AUTOINCREMENT,
  \`code\` TEXT,
  \`discount_type\` TEXT,
  \`discount_value\` REAL,
  \`min_order\` REAL,
  \`uses_left\` INTEGER,
  \`is_active\` INTEGER,
  \`expires_at\` TEXT,
  \`created_at\` TEXT
);

CREATE TABLE \`orders\` (
  \`id\` INTEGER PRIMARY KEY AUTOINCREMENT,
  \`order_number\` TEXT,
  \`user_id\` INTEGER,
  \`status\` TEXT,
  \`subtotal\` REAL,
  \`shipping_cost\` REAL,
  \`total\` REAL,
  \`payment_method\` TEXT,
  \`payment_ref\` TEXT,
  \`payment_proof\` TEXT,
  \`customer_message\` TEXT,
  \`shipping_address\` TEXT,
  \`shipping_city\` TEXT,
  \`admin_notes\` TEXT,
  \`created_at\` TEXT,
  \`updated_at\` TEXT
, shipping_method TEXT, cash_closure_id INTEGER REFERENCES cash_closures(id));

CREATE TABLE \`order_items\` (
  \`id\` INTEGER PRIMARY KEY AUTOINCREMENT,
  \`order_id\` INTEGER,
  \`product_id\` INTEGER,
  \`product_name\` TEXT,
  \`price\` REAL,
  \`quantity\` INTEGER,
  \`subtotal\` REAL
);

CREATE TABLE inventory_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      movement_type VARCHAR(50) NOT NULL,
      quantity_change INTEGER NOT NULL,
      previous_stock INTEGER NOT NULL,
      new_stock INTEGER NOT NULL,
      reference_id VARCHAR(100),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      sender_role TEXT NOT NULL CHECK(sender_role IN ('user', 'admin')),
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

CREATE TABLE product_reviews (
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

CREATE TABLE payment_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      details TEXT NOT NULL,
      requires_proof INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1
    );

CREATE TABLE shipping_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    cost REAL NOT NULL DEFAULT 0.0,
    estimated_time TEXT,
    description TEXT,
    is_active INTEGER DEFAULT 1
);

CREATE TABLE cash_closures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      opening_amount REAL NOT NULL,
      expected_amount REAL DEFAULT 0.0,
      actual_amount REAL,
      notes TEXT,
      status TEXT DEFAULT 'open',
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

CREATE TABLE suppliers (
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

CREATE TABLE purchase_orders (
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

CREATE TABLE purchase_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_order_id INTEGER NOT NULL,
        product_id INTEGER,
        product_name TEXT NOT NULL,
        cost_price REAL NOT NULL DEFAULT 0.0,
        quantity INTEGER NOT NULL,
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
      );

CREATE TABLE login_attempts (
        key TEXT PRIMARY KEY,
        attempts INTEGER NOT NULL DEFAULT 0,
        lockout_until INTEGER NOT NULL DEFAULT 0
      );

CREATE TABLE revoked_tokens (
        token TEXT PRIMARY KEY,
        revoked_at INTEGER NOT NULL
      );

CREATE TABLE user_credits (
    user_id INTEGER PRIMARY KEY,
    credit_limit REAL NOT NULL DEFAULT 0.0,
    credit_used REAL NOT NULL DEFAULT 0.0,
    loyalty_points INTEGER NOT NULL DEFAULT 0,
    credit_status TEXT NOT NULL DEFAULT 'active' CHECK(credit_status IN ('active', 'suspended', 'cancelled')),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

CREATE TABLE credit_requests (
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

CREATE TABLE credit_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount_change REAL NOT NULL,
    movement_type TEXT NOT NULL CHECK(movement_type IN ('purchase', 'payment', 'adjustment')),
    reference_id TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cash_closure_id INTEGER REFERENCES cash_closures(id) ON DELETE SET NULL,
    payment_method TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

CREATE TABLE loyalty_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    points_change INTEGER NOT NULL,
    reason TEXT NOT NULL,
    reference_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

CREATE TABLE audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id INTEGER,
        admin_email TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

CREATE TABLE rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL,
        reset_time INTEGER NOT NULL
      );

CREATE INDEX idx_orders_user_id ON orders(user_id);

CREATE INDEX idx_orders_status ON orders(status);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

CREATE INDEX idx_products_id_producto_padre ON products(id_producto_padre);

CREATE INDEX idx_product_images_product_id ON product_images(product_id);

CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);

CREATE INDEX idx_chat_messages_unread ON chat_messages(is_read) WHERE is_read = 0;

CREATE INDEX idx_product_reviews_product ON product_reviews(product_id, status);

CREATE INDEX idx_product_reviews_order ON product_reviews(order_id);

CREATE INDEX idx_products_active ON products(is_active, is_featured);

CREATE INDEX idx_inventory_movements_product_id ON inventory_movements(product_id);

CREATE UNIQUE INDEX idx_products_barcode ON products(barcode);

CREATE INDEX idx_orders_created_at ON orders(created_at);

CREATE INDEX idx_orders_cash_closure ON orders(cash_closure_id);

CREATE INDEX idx_users_email ON users(email);

CREATE INDEX idx_users_id_document ON users(id_document);

CREATE INDEX idx_users_phone ON users(phone);

CREATE INDEX idx_cash_closures_user ON cash_closures(user_id);

CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_id);

CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);


-- DEFAULT SETTINGS --

INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('site_name', 'Rexermi Marketplace', 'Nombre del sitio', 'general');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('site_tagline', 'Tu tienda de confianza en línea', 'Slogan', 'general');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('contact_email', 'jdlvanonymous@gmail.com', 'Email de contacto', 'general');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('contact_phone', '04123735830', 'Teléfono/WhatsApp', 'general');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('currency', 'USD', 'Moneda', 'general');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('currency_symbol', '$', 'Símbolo de moneda', 'general');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('payment_zoom', '04123735830/ 30655967 /0102', 'Número Zoom/Pago Móvil', 'payment');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('payment_bank', '', 'Datos bancarios', 'payment');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('payment_binance', '', 'Binance/Cripto', 'payment');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('payment_other', '', 'Otros métodos de pago', 'payment');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('shipping_info', 'Envío pago a destino por Zoom...', 'Envío pago a destino por Zoom...', 'shipping');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('min_order', '0', 'Pedido mínimo', 'general');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('logo_text', 'REXERMI', 'Texto del logo', 'general');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('primary_color', '#D4AF37', 'None', 'general');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('primary_color_light', '#ff0000', 'None', 'general');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('primary_color_dark', '#4c00ff', 'None', 'general');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('glass_blur', '29', 'None', 'general');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('glass_opacity', '0.88', 'None', 'general');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('logo_url', 'https://ih1.redbubble.net/image.3760742352.3511/flat,750x,075,f-pad,750x1000,f8f8f8.jpg', 'None', 'general');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('dark_mode_default', '0', 'None', 'general');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('text_color_dark', '#F0EFE8', 'Color del texto (oscuro)', 'theme');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('text_color_light', '#1A1A22', 'Color del texto (claro)', 'theme');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('bg_color_dark', '#0A0A0F', 'Fondo principal (oscuro)', 'theme');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('bg_color_light', '#F5F4EF', 'Fondo principal (claro)', 'theme');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('accent_dark', '#D4AF37', 'Color acento (oscuro)', 'theme');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('accent_light', '#A88C1E', 'Color acento (claro)', 'theme');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('store_open', '1', 'Estado de la Tienda', 'general');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('store_status_mode', 'manual', 'Modo de Operación', 'general');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('store_schedule_start', '08:00', 'Hora de Apertura', 'general');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('store_schedule_end', '18:00', 'Hora de Cierre', 'general');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('store_schedule_days', '1,2,3,4,5', 'Días de Operación', 'general');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('dollar_rate', '570', 'Tasa de cambio (Bs. / USD)', 'general');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('commission_rate', '5.0', 'Porcentaje de Comisión de Ventas (%)', 'general');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('credit_enabled', '0', 'credit_enabled', 'credit');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('credit_mode', 'free', 'credit_mode', 'credit');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('credit_schedule_mode', 'always', 'credit_schedule_mode', 'credit');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('credit_schedule_start', '08:00', 'credit_schedule_start', 'credit');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('credit_schedule_end', '18:00', 'credit_schedule_end', 'credit');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('credit_schedule_days', '1,2,3,4,5', 'credit_schedule_days', 'credit');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('credit_season_start', '', 'credit_season_start', 'credit');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('credit_season_end', '', 'credit_season_end', 'credit');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('loyalty_points_per_dollar', '0.1', 'loyalty_points_per_dollar', 'credit');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('loyalty_points_to_credit_multiplier', '2.0', 'loyalty_points_to_credit_multiplier', 'credit');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('loyalty_min_points_for_credit', '50', 'loyalty_min_points_for_credit', 'credit');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('loyalty_initial_points', '0', 'loyalty_initial_points', 'credit');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');
INSERT OR IGNORE INTO settings (\`key\`, value, label, \`group\`) VALUES ('last_backup_at', '2026-06-09T13:52:37.609Z', 'Último respaldo', 'backup');

-- DEFAULT ADMINS --

INSERT OR IGNORE INTO admin_users (id, username, password, full_name, email, created_at, role) VALUES (1, 'admin', '$2b$12$VBwLYTpQks1JAixWxX7hTuE0X4YxGtHJaBiOZ.qgA3ADSUMov2coe', 'Administrador Rexermi', 'admin@rexermi.uk', '2026-05-17 04:09:50', 'admin');
INSERT OR IGNORE INTO admin_users (id, username, password, full_name, email, created_at, role) VALUES (2, 'vendedor1', '$2b$10$mAx.mfb98fYWfn1augkR0eG9TU/7nhA/ePXoZnptHZHuYiowx1Tlu', 'Vendedor de Prueba', 'vendedor@test.com', NULL, 'vendedor');
`;
