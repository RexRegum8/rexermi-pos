const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'app', 'vendedor', 'page.tsx');
const content = fs.readFileSync(file, 'utf8');

const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('onChange') && (line.includes('search') || line.includes('query') || line.includes('Search') || line.includes('Client') || line.includes('Customer'))) {
    console.log(`Línea ${index + 1}: ${line.trim()}`);
  }
});
