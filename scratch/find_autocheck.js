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

console.log('--- Finding auto-check triggers in src/ ---');
walkDir(path.join(__dirname, '..', 'src'), filePath => {
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes('auto-check') || content.includes('auto_check')) {
      console.log(`File: ${filePath}`);
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('auto-check') || line.includes('auto_check')) {
          console.log(`  L${idx + 1}: ${line.trim()}`);
        }
      });
    }
  }
});
