@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo   REXERMI Marketplace - Windows Setup ^& Deploy
echo ===================================================
echo.

:: 1. Verify Node.js and NPM
where node >nul 2>&1
if !ERRORLEVEL! neq 0 (
    echo [ERROR] Node.js no esta instalado. Por favor, descargalo e instalalo desde https://nodejs.org/
    pause
    exit /b 1
)

where npm >nul 2>&1
if !ERRORLEVEL! neq 0 (
    echo [ERROR] NPM no esta instalado pero Node.js si. Revisa tu configuracion de PATH.
    pause
    exit /b 1
)

echo [✓] Node.js detectado:
node -v
echo [✓] NPM detectado:
call npm -v
echo.

:: 2. Create Required Directories
echo [1/4] Creando directorios necesarios...
if not exist "src\data" (
    mkdir "src\data"
    echo   [+] Creado src\data
)
if not exist "public\assets\uploads" (
    mkdir "public\assets\uploads"
    echo   [+] Creado public\assets\uploads
)
if not exist "private\receipts" (
    mkdir "private\receipts"
    echo   [+] Creado private\receipts
)
echo.

:: 3. Configure Local Environment Variables
echo [2/4] Configurando variables de entorno (.env.local)...
if not exist ".env.local" (
    copy ".env.example" ".env.local" >nul
    echo   [+] Creado .env.local desde plantilla .env.example
    echo   [!] ATENCION: Edita .env.local e introduce un JWT_SECRET robusto.
) else (
    echo   [~] .env.local ya existe. Saltando creacion.
)
echo.

:: 4. Clean Install Dependencies
echo [3/4] Instalando dependencias del proyecto (npm install)...
call npm install
if !ERRORLEVEL! neq 0 (
    echo.
    echo [ERROR] Hubo un problema al instalar las dependencias de node_modules.
    pause
    exit /b 1
)
echo [✓] Dependencias instaladas correctamente.
echo.

:: 5. Compile next.js app
echo [4/4] Construyendo aplicacion optimizada para produccion (npm run build)...
call npm run build
if !ERRORLEVEL! neq 0 (
    echo.
    echo [ERROR] Error de compilacion en Next.js. Revisa los logs.
    pause
    exit /b 1
)
echo [✓] Compilacion completada con exito.
echo.

echo ===================================================
echo   REXERMI Marketplace - CONFIGURACION COMPLETADA
echo ===================================================
echo.
echo   * URL de la Tienda: http://localhost:8080
echo   * Panel de Control Admin: http://localhost:8080/admin
echo   * Terminal Punto de Venta: http://localhost:8080/pos
echo   * Widget de Control: http://localhost:8080/admin-control-widget.html
echo.
echo Para iniciar el servidor de desarrollo ejecuta: npm run dev
echo Para iniciar el servidor de produccion ejecuta: npm start
echo.
pause
