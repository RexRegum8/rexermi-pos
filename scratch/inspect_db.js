const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);

try {
  const products = db.prepare("SELECT id, name, slug, image, image2, image3 FROM products WHERE slug = 'audifonos' OR id = 123 OR name LIKE '%audifonos%'").all();
  console.log("Productos encontrados:", JSON.stringify(products, null, 2));

  const images = db.prepare("SELECT * FROM product_images WHERE product_id = 123").all();
  console.log("Imágenes secundarias:", JSON.stringify(images, null, 2));
} catch (err) {
  console.error("Error al consultar:", err);
} finally {
  db.close();
}
