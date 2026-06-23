const fs = require('fs');
const content = fs.readFileSync('src/app/pos/page.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('vendedor')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
