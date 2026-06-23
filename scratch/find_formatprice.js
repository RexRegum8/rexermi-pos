const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

console.log('--- Finding formatPrice usages in src/ ---');
walkDir(path.join(__dirname, '..', 'src'), filePath => {
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes('formatPrice')) {
      console.log(`File: ${filePath}`);
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('formatPrice')) {
          console.log(`  L${idx + 1}: ${line.trim()}`);
        }
      });
    }
  }
});
