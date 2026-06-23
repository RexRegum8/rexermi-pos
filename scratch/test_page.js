const http = require('http');

function testUrl(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`URL: ${url} -> Status: ${res.statusCode}, Length: ${data.length}`);
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`Status ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  try {
    const detailHtml = await testUrl('http://localhost:8080/product/cable-usb-c');
    console.log('Product detail page works! Contains "Rexermi"?', detailHtml.includes('Rexermi'));
    
    const homeHtml = await testUrl('http://localhost:8080/');
    console.log('Homepage works! Contains "Rexermi"?', homeHtml.includes('Rexermi'));
  } catch (err) {
    console.error('Test failed:', err.message);
  }
}

run();

