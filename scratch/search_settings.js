const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'app', 'admin', '(dashboard)', 'settings', 'AdminSettingsForm.tsx');
const content = fs.readFileSync(file, 'utf8');

console.log('¿Importa useToast?', content.includes('useToast'));
console.log('¿Usa showToast?', content.includes('showToast'));

const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('alert(') || line.includes('showToast') || line.includes('handleSave') || line.includes('confirm(')) {
    console.log(`Línea ${index + 1}: ${line.trim()}`);
  }
});
