@echo off
echo ===================================================
echo   Descargando Electron binaries manualmente...
echo ===================================================
echo.

if not exist "node_modules\electron" (
    echo [ERROR] Carpeta node_modules\electron no encontrada. Ejecuta npm install primero.
    exit /b 1
)

:: Ensure dist directory exists
if not exist "node_modules\electron\dist" mkdir "node_modules\electron\dist"

:: Download Zip via PowerShell (avoids curl/wget issues)
echo [+] Descargando electron-v30.5.1-win32-x64.zip...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/electron/electron/releases/download/v30.5.1/electron-v30.5.1-win32-x64.zip' -OutFile 'electron_temp.zip' -UseBasicParsing"
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Fallo al descargar el zip de Electron.
    exit /b 1
)

:: Extract Zip via PowerShell
echo [+] Extrayendo archivos en node_modules\electron\dist...
powershell -Command "Expand-Archive -Path 'electron_temp.zip' -DestinationPath 'node_modules\electron\dist' -Force"
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Fallo al extraer el zip.
    exit /b 1
)

:: Write path.txt cleanly (no trailing spaces or newlines)
echo [+] Configurando path.txt...
<nul set /p="electron.exe" > node_modules\electron\path.txt

:: Cleanup
if exist "electron_temp.zip" del "electron_temp.zip"

echo [✓] Electron reinstalado con exito.
exit /b 0
