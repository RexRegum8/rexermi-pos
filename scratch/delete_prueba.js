const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);

try {
  const user = db.prepare("SELECT id FROM users WHERE email = 'prueba@gmail.com'").get();
  if (!user) {
    console.log("User 'prueba@gmail.com' not found.");
    process.exit(0);
  }

  const userId = user.id;
  console.log(`Found user 'prueba' with ID: ${userId}`);

  // Delete closures associated with this user
  const closuresResult = db.prepare("DELETE FROM cash_closures WHERE user_id = ?").run(userId);
  console.log(`Deleted ${closuresResult.changes} cash closure(s) for user ID: ${userId}`);

  // Delete orders associated with this user
  const ordersResult = db.prepare("DELETE FROM orders WHERE user_id = ?").run(userId);
  console.log(`Deleted ${ordersResult.changes} order(s) for user ID: ${userId}`);

  // Delete reviews associated with this user (though DB has ON DELETE CASCADE, let's be explicit)
  const reviewsResult = db.prepare("DELETE FROM product_reviews WHERE user_id = ?").run(userId);
  console.log(`Deleted ${reviewsResult.changes} product review(s) for user ID: ${userId}`);

  // Finally, delete the user
  const userResult = db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  console.log(`Successfully deleted user 'prueba' (changes: ${userResult.changes})`);

} catch (error) {
  console.error("Error during deletion:", error);
}
