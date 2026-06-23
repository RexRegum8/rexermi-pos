const fs = require('fs');
const path = require('path');
const cssPath = path.join(__dirname, '..', 'src', 'app', 'globals.css');
const content = fs.readFileSync(cssPath, 'utf8');

const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('mobile-user-btn') || line.includes('nav-actions')) {
    console.log(`${idx + 1}: ${line}`);
  }
});
