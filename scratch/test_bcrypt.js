const bcrypt = require('bcryptjs');

const hash = '$2b$12$SGvwyvgwORw7nBz76ddnGuTWm7mjkOsUlb9zknPcx.E2sThYff/r.';
const password = 'admin'; // wait, what if the password is admin? Or what if it's admin123?

console.log("Original Hash:", hash);
console.log("Replacing $2b$ with $2a$:", hash.replace(/^\$2b\$/, '$2a$'));

async function test() {
  // Let's test different passwords to see if we can guess it or check how compare works
  const candidates = ['admin', '12345678', 'admin123', 'admin12345', 'rexermi', 'Rexermi123', 'admin123456'];
  for (const c of candidates) {
    const directMatch = await bcrypt.compare(c, hash);
    const replacedHash = hash.replace(/^\$2b\$/, '$2a$');
    const replacedMatch = await bcrypt.compare(c, replacedHash);
    console.log(`Password "${c}": directMatch=${directMatch}, replacedMatch=${replacedMatch}`);
  }
}

test().catch(console.error);
