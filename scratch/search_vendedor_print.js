const fs = require('fs');
const content = fs.readFileSync('src/app/vendedor/page.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.toLowerCase().includes('print') || line.toLowerCase().includes('ticket') || line.toLowerCase().includes('recibo') || line.toLowerCase().includes('bill')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
