import mysql from 'mysql2/promise';

async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'rexermi_db'
  });

  const [settings] = await connection.query("SELECT * FROM settings");
  console.log("Settings:");
  console.table(settings);

  await connection.end();
}

main().catch(err => {
  console.error("Error view settings:", err);
});
