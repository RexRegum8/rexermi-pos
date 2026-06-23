const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'app', 'globals.css');
const content = fs.readFileSync(file, 'utf8');

const lines = content.split('\n');
let print = false;
let brackets = 0;
lines.forEach((line, index) => {
  if (line.includes('.toast-container') || line.includes('.toast {') || line.includes('@keyframes slideIn')) {
    print = true;
  }
  if (print) {
    console.log(`${index + 1}: ${line}`);
    if (line.includes('{')) brackets++;
    if (line.includes('}')) brackets--;
    if (brackets === 0 && !line.includes('{')) {
      // Solo parar si estamos fuera de brackets y no es la primera linea
      print = false;
    }
  }
});
