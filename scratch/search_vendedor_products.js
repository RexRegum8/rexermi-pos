const fs = require('fs');
const content = fs.readFileSync('src/app/vendedor/page.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('products') && (line.includes('setProducts') || line.includes('useState') || line.includes('fetch'))) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
