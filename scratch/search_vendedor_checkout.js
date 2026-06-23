const fs = require('fs');
const content = fs.readFileSync('src/app/vendedor/page.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('checkout') && (line.includes('const') || line.includes('function') || line.includes('await'))) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
