import sqlite3
import os

db_path = os.path.join('src', 'data', 'database.sqlite')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# 1. Create shipping_methods table
cursor.execute("""
CREATE TABLE IF NOT EXISTS shipping_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    cost REAL NOT NULL DEFAULT 0.0,
    estimated_time TEXT,
    description TEXT,
    is_active INTEGER DEFAULT 1
)
""")
print("Table shipping_methods verified/created.")

# 2. Add shipping_method column to orders if not exists
cursor.execute("PRAGMA table_info(orders)")
columns = cursor.fetchall()
has_shipping_method = False
for col in columns:
    if col[1] == 'shipping_method':
        has_shipping_method = True
        break

if not has_shipping_method:
    cursor.execute("ALTER TABLE orders ADD COLUMN shipping_method TEXT")
    print("Added shipping_method column to orders table.")
else:
    print("Column shipping_method already exists in orders table.")

# 3. Seed initial shipping methods if table is empty
cursor.execute("SELECT COUNT(*) FROM shipping_methods")
count = cursor.fetchone()[0]
if count == 0:
    initial_methods = [
        ("Zoom (Cobro en Destino)", 0.0, "2-3 días hábiles", "Envío cobro a destino pagadero al recibir en oficina Zoom."),
        ("Domesa (Cobro en Destino)", 0.0, "2-3 días hábiles", "Envío cobro a destino pagadero al recibir en oficina Domesa."),
        ("Delivery Express Caracas", 5.0, "Mismo día", "Servicio de motorizado express dentro de Caracas metropolitana."),
        ("Retiro en Tienda", 0.0, "Inmediato", "Retira tu pedido directamente en nuestra sede principal sin costo.")
    ]
    cursor.executemany(
        "INSERT INTO shipping_methods (name, cost, estimated_time, description, is_active) VALUES (?, ?, ?, ?, 1)",
        initial_methods
    )
    print("Seeded initial shipping methods.")
else:
    print("Shipping methods table already contains data.")

conn.commit()
conn.close()
print("Migration completed successfully.")
