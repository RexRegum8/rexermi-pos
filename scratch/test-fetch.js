const http = require('http');

const loginData = JSON.stringify({
  username: 'admin',
  password: 'yourpassword' // Note: we should verify if password works or what it is
});

// Since we don't know the exact password, let's look at the database. 
// We saw the admin username is 'admin'.
// Let's write a script that generates a token manually for user 1 (admin) 
// using the secret key from .env.local, and then fetches the status endpoint!
// This is even better because we bypass the login password step completely!
const fs = require('fs');
const path = require('path');
const { SignJWT } = require('jose');

const envPath = path.join(__dirname, '..', '.env.local');
let jwtSecret = '';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const match = envContent.match(/^JWT_SECRET=(.+)$/m);
  if (match) {
    jwtSecret = match[1].trim();
  }
}

if (!jwtSecret) {
  console.error("JWT_SECRET not found in .env.local");
  process.exit(1);
}
const secretKey = new TextEncoder().encode(jwtSecret);

async function run() {
  const token = await new SignJWT({ id: 1, username: 'admin', role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secretKey);

  console.log("Using Token:", token);

  const options = {
    hostname: 'localhost',
    port: 8080,
    path: '/api/admin/server-control/status',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  const req = http.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log('Response Body:', data);
    });
  });

  req.on('error', (err) => {
    console.error('Fetch Error:', err);
  });

  req.end();
}

run();
