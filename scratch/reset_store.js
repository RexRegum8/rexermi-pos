const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);

console.log("=== STARTING COMPLETE RESET OF TEST DATA ===");

try {
  db.transaction(() => {
    // 1. Delete all transaction data
    const delOrderItems = db.prepare("DELETE FROM order_items").run();
    console.log(`Deleted ${delOrderItems.changes} row(s) from order_items.`);

    const delOrders = db.prepare("DELETE FROM orders").run();
    console.log(`Deleted ${delOrders.changes} row(s) from orders.`);

    const delClosures = db.prepare("DELETE FROM cash_closures").run();
    console.log(`Deleted ${delClosures.changes} row(s) from cash_closures.`);

    const delMovements = db.prepare("DELETE FROM inventory_movements").run();
    console.log(`Deleted ${delMovements.changes} row(s) from inventory_movements.`);

    // 2. Delete all communications & reviews
    const delChats = db.prepare("DELETE FROM chat_messages").run();
    console.log(`Deleted ${delChats.changes} row(s) from chat_messages.`);

    const delReviews = db.prepare("DELETE FROM product_reviews").run();
    console.log(`Deleted ${delReviews.changes} row(s) from product_reviews.`);

    // 3. Delete product images & products (test catalog)
    const delProductImages = db.prepare("DELETE FROM product_images").run();
    console.log(`Deleted ${delProductImages.changes} row(s) from product_images.`);

    const delProducts = db.prepare("DELETE FROM products").run();
    console.log(`Deleted ${delProducts.changes} row(s) from products.`);

    // 4. Delete all users except Ruben
    const delUsers = db.prepare("DELETE FROM users WHERE email != 'paezyanez23@gmail.com'").run();
    console.log(`Deleted ${delUsers.changes} user/customer accounts (Ruben preserved).`);

    // 5. Reset SQLite autoincrement sequences to start IDs from 1
    const tablesToReset = ['orders', 'order_items', 'cash_closures', 'inventory_movements', 'chat_messages', 'product_reviews', 'product_images', 'products', 'users'];
    for (const t of tablesToReset) {
      db.prepare("DELETE FROM sqlite_sequence WHERE name = ?").run(t);
    }
    console.log("Reset autoincrement sequences for all cleared tables.");

    console.log("=== RESET COMPLETED SUCCESSFULLY ===");
  })();
} catch (error) {
  console.error("Error during database reset:", error);
}
