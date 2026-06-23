const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'app', 'vendedor', 'page.tsx');
const content = fs.readFileSync(file, 'utf8');

const lines = content.split('\n');
const searchFuncIndex = lines.findIndex(l => l.includes('handleCustomerSearchChange'));
console.log('Línea handleCustomerSearchChange:', searchFuncIndex + 1);
if (searchFuncIndex !== -1) {
  for (let i = searchFuncIndex - 2; i < searchFuncIndex + 30; i++) {
    console.log(`${i+1}: ${lines[i]}`);
  }
}

console.log('\n--- Búsqueda de productos ---');
const prodFilterIndex = lines.findIndex(l => l.includes('const filteredProducts'));
console.log('Línea filteredProducts:', prodFilterIndex + 1);
if (prodFilterIndex !== -1) {
  for (let i = prodFilterIndex - 2; i < prodFilterIndex + 25; i++) {
    console.log(`${i+1}: ${lines[i]}`);
  }
}
