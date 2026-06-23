const { SignJWT, jwtVerify } = require('jose');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
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

async function createToken(payload, expiresIn = '24h') {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey);
}

async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch (err) {
    console.error("JWT Verify Error:", err.message);
    return null;
  }
}

async function run() {
  const payload = { id: 1, username: 'admin', role: 'admin' };
  const token = await createToken(payload);
  console.log("Generated Token:", token);
  const verified = await verifyToken(token);
  console.log("Verified Payload:", verified);
}

run();
