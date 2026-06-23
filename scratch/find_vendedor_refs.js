const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    const stat = fs.statSync(filepath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        walk(filepath, callback);
      }
    } else {
      callback(filepath);
    }
  }
}

console.log('Searching for "/vendedor" references (case insensitive or exact URLs)...');
walk('.', (filepath) => {
  if (filepath.endsWith('.tsx') || filepath.endsWith('.ts') || filepath.endsWith('.js') || filepath.endsWith('.json')) {
    const content = fs.readFileSync(filepath, 'utf8');
    if (content.includes('/vendedor') || content.includes('vendedor/page') || content.includes('vendedor/layout') || content.includes('redirect(\'/vendedor\')') || content.includes('router.push(\'/vendedor\')')) {
      console.log(`Found in: ${filepath}`);
    }
  }
});
