const fs = require('fs');
const path = require('path');

function search(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      search(fullPath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
      const code = fs.readFileSync(fullPath, 'utf8');
      if (code.includes('UPDATE categories') || code.includes('DELETE FROM categories') || code.includes('categories SET')) {
        console.log(`Found categories update in: ${fullPath}`);
      }
    }
  }
}

search(path.join(__dirname, '..', 'src'));
