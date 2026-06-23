const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');

const version = '30.5.1';
const zipName = `electron-v${version}-win32-x64.zip`;
const url = `https://github.com/electron/electron/releases/download/v${version}/${zipName}`;
const zipPath = path.join(__dirname, 'electron_temp.zip');
const destDir = path.join(__dirname, 'node_modules', 'electron', 'dist');

console.log(`[+] Descargando Electron v${version} desde GitHub...`);

function downloadFile(targetUrl) {
  https.get(targetUrl, (res) => {
    // Follow Redirects
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      return downloadFile(res.headers.location);
    }
    
    if (res.statusCode !== 200) {
      console.error(`[ERROR] Conexión fallida con código: ${res.statusCode}`);
      process.exit(1);
    }
    
    const fileStream = fs.createWriteStream(zipPath);
    res.pipe(fileStream);
    
    fileStream.on('finish', () => {
      fileStream.close(() => {
        console.log(`[+] Descarga completada con éxito. Archivo: ${zipPath}`);
        
        // Ensure dist directory exists
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        
        console.log(`[+] Extrayendo archivos usando PowerShell en: ${destDir}...`);
        
        // Run PowerShell Expand-Archive command
        const psCommand = `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`;
        exec(psCommand, (err, stdout, stderr) => {
          if (err) {
            console.error('[ERROR] Error al extraer el zip con PowerShell:', err);
            console.error(stderr);
            process.exit(1);
          }
          
          console.log('[+] Extracción finalizada correctamente.');
          
          // Write path.txt
          fs.writeFileSync(path.join(__dirname, 'node_modules', 'electron', 'path.txt'), 'electron.exe');
          console.log('[+] Escribiendo path.txt...');
          
          // Delete zip
          try {
            fs.unlinkSync(zipPath);
            console.log('[+] Limpiando archivos temporales...');
          } catch (e) {}
          
          console.log('\n[ÉXITO] ¡Electron se ha instalado correctamente de forma manual!');
          process.exit(0);
        });
      });
    });
  }).on('error', (err) => {
    console.error('[ERROR] Error de descarga:', err);
    process.exit(1);
  });
}

downloadFile(url);
