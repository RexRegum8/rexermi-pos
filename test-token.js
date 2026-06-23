// Test token verification
const { createToken, verifyToken } = require('./src/lib/auth.ts');

async function run() {
  try {
    const payload = { id: 1, username: 'admin', role: 'admin' };
    const token = await createToken(payload);
    console.log("Token generated:", token);
    const verified = await verifyToken(token);
    console.log("Verified payload:", verified);
  } catch (err) {
    console.error("Test failed:", err);
  }
}

run();
