const http = require('http');

http.get('http://localhost:8080/api/assets/uploads/prod_1780008769251.png', (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers);
  let data = [];
  res.on('data', (chunk) => {
    data.push(chunk);
  });
  res.on('end', () => {
    const buffer = Buffer.concat(data);
    console.log('Size of returned file:', buffer.length);
  });
}).on('error', (err) => {
  console.error('Error connecting to dev server:', err.message);
});
