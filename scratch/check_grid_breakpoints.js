const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'app', 'globals.css');
const content = fs.readFileSync(file, 'utf8');

const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('products-grid') || line.includes('product-card') || line.includes('navbar') || line.includes('nav-inner')) {
    console.log(`Línea ${index + 1}: ${line.trim()}`);
  }
});
