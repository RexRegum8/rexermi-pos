const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);

console.log("Starting full database cleanup of test data...");

try {
  db.transaction(() => {
    // 1. Delete all orders and order items
    const delOrderItems = db.prepare("DELETE FROM order_items").run();
    console.log(`Deleted ${delOrderItems.changes} row(s) from order_items.`);

    const delOrders = db.prepare("DELETE FROM orders").run();
    console.log(`Deleted ${delOrders.changes} row(s) from orders.`);

    // 2. Delete all cash closures
    const delClosures = db.prepare("DELETE FROM cash_closures").run();
    console.log(`Deleted ${delClosures.changes} row(s) from cash_closures.`);

    // 3. Delete all inventory movements (resets history, but preserves current stock in products)
    const delMovements = db.prepare("DELETE FROM inventory_movements").run();
    console.log(`Deleted ${delMovements.changes} row(s) from inventory_movements.`);

    // 4. Delete all chat messages
    const delChats = db.prepare("DELETE FROM chat_messages").run();
    console.log(`Deleted ${delChats.changes} row(s) from chat_messages.`);

    // 5. Delete all product reviews
    const delReviews = db.prepare("DELETE FROM product_reviews").run();
    console.log(`Deleted ${delReviews.changes} row(s) from product_reviews.`);

    // 6. Delete test customers (keep vendedores)
    const delUsers = db.prepare("DELETE FROM users WHERE role = 'user' AND email != 'prueba@gmail.com'").run();
    console.log(`Deleted ${delUsers.changes} customer user(s) (vendedores and admin accounts preserved).`);

    console.log("Database reset completed successfully!");
  })();
} catch (error) {
  console.error("Error resetting database:", error);
}
