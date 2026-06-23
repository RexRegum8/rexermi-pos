const fs = require('fs');
const content = fs.readFileSync('src/app/vendedor/page.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('barcode') || line.includes('focus') || line.includes('scanner') || line.includes('ref')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
