import { NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

let fs: any = null;
let path: any = null;

if (typeof EdgeRuntime !== 'string') {
  const requireFunc = typeof __webpack_require__ === "function" ? __non_webpack_require__ : require;
  fs = requireFunc('fs');
  path = requireFunc('path');
}


const SETUP_BAT = `@echo off
setlocal enabledelayedexpansion
echo ===================================================
echo   REXERMI Marketplace - Windows Setup ^& Deploy
echo ===================================================
echo.
where node >nul 2>&1
if !ERRORLEVEL! neq 0 (
    echo [ERROR] Node.js no esta instalado. Descargalo en https://nodejs.org
    pause & exit /b 1
)
echo [1/4] Creando directorios necesarios...
if not exist "src\\data" mkdir "src\\data"
if not exist "public\\assets\\uploads" mkdir "public\\assets\\uploads"
if not exist "private\\receipts" mkdir "private\\receipts"
echo [2/4] Configurando variables de entorno...
if not exist .env.local (
    copy .env.example .env.local >nul
    echo Creado .env.local desde plantilla .env.example
)
echo [3/4] Instalando dependencias...
call npm install
if !ERRORLEVEL! neq 0 ( echo ERROR al instalar & pause & exit /b 1 )
echo [4/4] Construyendo la aplicacion...
call npm run build
if !ERRORLEVEL! neq 0 ( echo ERROR al construir & pause & exit /b 1 )
echo.
echo Servidor configurado con exito.
echo Tienda: http://localhost:8080
echo Admin: http://localhost:8080/admin
echo POS: http://localhost:8080/pos
echo.
call npm start
pause
`;

const SETUP_SH = `#!/bin/bash
echo "==================================================="
echo "  REXERMI Marketplace - Linux Setup & Deploy"
echo "==================================================="
echo
command -v node &>/dev/null || { echo "Instala Node.js desde https://nodejs.org"; exit 1; }
mkdir -p src/data public/assets/uploads private/receipts
[ ! -f .env.local ] && cp .env.example .env.local && echo "Creado .env.local desde plantilla .env.example"
npm install && npm run build || exit 1
chmod -R 775 public/assets/uploads private/receipts src/data
if [ "$EUID" -eq 0 ] && getent group www-data > /dev/null; then
    chown -R :www-data public/assets/uploads private/receipts src/data
fi
echo "Servidor configurado con éxito. Abre http://localhost:8080"
npm start
`;

const README_MD = `# Rexermi Marketplace — Paquete de Transmigración

## Requisitos
- Node.js 18+ (https://nodejs.org)

## Instalación rápida

### Windows
Doble clic en setup.bat

### Linux / Mac
\`\`\`bash
chmod +x setup.sh && ./setup.sh
\`\`\`

## Estructura
- src/data/database.sqlite — Base de datos con todos los datos
- .env.example → copiar a .env.local y cambiar JWT_SECRET

## URLs después de instalar
- Tienda:    http://localhost:8080
- Admin:     http://localhost:8080/admin
- POS:        http://localhost:8080/pos
`;

const ENV_EXAMPLE = `# REXERMI — Variables de Entorno
# CAMBIA JWT_SECRET por una cadena aleatoria segura de 32+ caracteres
JWT_SECRET=CAMBIAR_ESTE_SECRET_POR_UNO_SEGURO_DE_AL_MENOS_32_CARACTERES
`;

function addDirectoryToZip(zip: JSZip, dirPath: string, zipPrefix: string, ignore: RegExp[] = []) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const zipPath = zipPrefix ? `${zipPrefix}/${entry.name}` : entry.name;
    
    // Check ignore patterns
    if (ignore.some(p => p.test(fullPath))) continue;
    
    if (entry.isDirectory()) {
      addDirectoryToZip(zip, fullPath, zipPath, ignore);
    } else {
      try {
        const content = fs.readFileSync(fullPath);
        zip.file(zipPath, content);
      } catch { /* skip unreadable files */ }
    }
  }
}

export async function GET(req: Request) {
  const admin = await verifyAdminToken(req as any);
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (typeof EdgeRuntime === 'string') {
    return NextResponse.json(
      { error: 'La transmigración de archivos locales no está soportada en entornos serverless (Cloudflare Pages).' },
      { status: 501 }
    );
  }

  try {
    const PROJECT_ROOT = process['cwd']();

    // turbopackIgnore: true — dynamic path is intentional for runtime file access
    const DB_PATH = path.join(PROJECT_ROOT, 'src', 'data', 'database.sqlite');

    const zip = new JSZip();

    const IGNORE_PATTERNS = [
      /[/\\]node_modules[/\\]/,
      /[/\\]\.next[/\\]/,
      /[/\\]\.git[/\\]/,
      /[/\\]backups[/\\]/,
    ];

    // Add source directories (including private folder for upload receipts)
    const DIRS_TO_ADD = ['src', 'public', 'private'];
    for (const dir of DIRS_TO_ADD) {
      const fullPath = path.join(PROJECT_ROOT, dir);
      addDirectoryToZip(zip, fullPath, dir, IGNORE_PATTERNS);
    }

    // Add individual files
    const FILES_TO_ADD = ['package.json', 'package-lock.json', 'next.config.ts', 'tsconfig.json'];
    for (const file of FILES_TO_ADD) {
      const fullPath = path.join(PROJECT_ROOT, file);
      if (fs.existsSync(fullPath)) {
        zip.file(file, fs.readFileSync(fullPath));
      }
    }

    // Add database
    if (fs.existsSync(DB_PATH)) {
      zip.file('src/data/database.sqlite', fs.readFileSync(DB_PATH));
    }

    // Add setup scripts and docs
    zip.file('setup.bat',    SETUP_BAT);
    zip.file('setup.sh',     SETUP_SH);
    zip.file('README.md',    README_MD);
    zip.file('.env.example', ENV_EXAMPLE);

    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    // JSZip returns a Buffer in Node.js; cast to Uint8Array which is a valid BodyInit
    const uint8 = new Uint8Array(buffer);
    const filename = `rexermi-transmigrate-${new Date().toISOString().slice(0, 10)}.zip`;

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': uint8.byteLength.toString(),
      },
    });
  } catch (err: any) {
    console.error('[backup/transmigrate]', err);
    return NextResponse.json({ error: err.message || 'Error al crear paquete' }, { status: 500 });
  }
}
