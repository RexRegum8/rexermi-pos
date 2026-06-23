const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'src', 'data', 'database.sqlite');
const db = new Database(dbPath);

const user = db.prepare("SELECT * FROM users WHERE email = 'prueba@gmail.com'").get();
console.log("USER:", user);

if (user) {
  const orders = db.prepare("SELECT * FROM orders WHERE user_id = ?").all(user.id);
  console.log("ORDERS FOR USER:", orders);

  const closures = db.prepare("SELECT * FROM cash_closures WHERE user_id = ?").all(user.id);
  console.log("CASH CLOSURES FOR USER:", closures);
  
  const chatMessages = db.prepare("SELECT * FROM chat_messages WHERE user_id = ?").all(user.id);
  console.log("CHAT MESSAGES FOR USER:", chatMessages);
}
