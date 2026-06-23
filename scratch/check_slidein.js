const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'app', 'globals.css');
const content = fs.readFileSync(file, 'utf8');

const regex = /@keyframes\s+slideIn/g;
console.log('¿Existe @keyframes slideIn?', regex.test(content));

const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('slideIn') || line.includes('toast')) {
    console.log(`Línea ${index + 1}: ${line.trim()}`);
  }
});
