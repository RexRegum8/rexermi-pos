@echo off
:: Configurar terminal a UTF-8 para mostrar acentos y emojis correctamente
chcp 65001 >nul
setlocal enabledelayedexpansion
title Rexermi Server Manager

:: Guardar el directorio raíz del proyecto
set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

:MENU
set "opcion="
cls
echo =================================================================
echo        REXERMI Marketplace - Iniciador del Servidor
echo =================================================================
echo.
echo  [1] Iniciar en Modo Desarrollo (npm run dev)
echo      - Recomendado para pruebas y desarrollo.
echo      - Recarga automática cuando editas el código.
echo.
echo  [2] Iniciar en Modo Producción (npm start)
echo      - Ejecuta el servidor optimizado para mejor rendimiento.
echo      - Requiere haber compilado el proyecto previamente (Opción 3).
echo.
echo  [3] Compilar y Iniciar en Modo Producción (npm run build + start)
echo      - Compila la aplicación con los cambios más recientes
echo        y luego la inicia de forma optimizada.
echo.
echo  [4] Ejecutar Configuración Inicial (setup.bat)
echo      - Instala dependencias, crea carpetas necesarias y compila.
echo.
echo  [5] Iniciar Widget de Escritorio (Electron)
echo      - Abre el monitor de estado de hardware y controles del servidor.
echo.
echo  [6] Salir
echo.
echo =================================================================
echo.
set /p opcion="Elija una opción (1-6) y presione Enter: "

if "%opcion%"=="1" goto VERIFY_DEV
if "%opcion%"=="2" goto VERIFY_START
if "%opcion%"=="3" goto BUILD_START
if "%opcion%"=="4" goto SETUP
if "%opcion%"=="5" goto WIDGET
if "%opcion%"=="6" goto EXIT
goto MENU

:VERIFY_DEV
call :CHECK_PRE_REQUISITES
if !ERRORLEVEL! neq 0 goto MENU
goto DEV

:VERIFY_START
call :CHECK_PRE_REQUISITES
if !ERRORLEVEL! neq 0 goto MENU
goto START

:DEV
echo.
echo =================================================================
echo  [✓] Iniciando servidor de desarrollo...
echo  * Tienda: http://localhost:8080
echo  * Panel Admin: http://localhost:8080/admin
echo  * Punto de Venta (POS): http://localhost:8080/pos
echo.
echo  Presione CTRL+C y confirme con 'S' para detener el servidor.
echo =================================================================
echo.
call npm run dev
echo.
echo Servidor detenido.
pause
goto MENU

:START
echo.
echo =================================================================
echo  [✓] Iniciando servidor en modo producción...
echo  * Tienda: http://localhost:8080
echo  * Panel Admin: http://localhost:8080/admin
echo  * Punto de Venta (POS): http://localhost:8080/pos
echo.
echo  Presione CTRL+C y confirme con 'S' para detener el servidor.
echo =================================================================
echo.
call npm start
if !ERRORLEVEL! neq 0 (
    echo.
    echo [ERROR] No se pudo iniciar el servidor.
    echo ¿Ha compilado el proyecto previamente? Intente usar la Opción [3].
    echo.
    pause
)
goto MENU

:BUILD_START
call :CHECK_PRE_REQUISITES
if !ERRORLEVEL! neq 0 goto MENU
echo.
echo =================================================================
echo  [1/2] Compilando la aplicación para producción (npm run build)...
echo =================================================================
echo.
call npm run build
if !ERRORLEVEL! neq 0 (
    echo.
    echo [ERROR] Error durante la compilación. Revisa los mensajes superiores.
    pause
    goto MENU
)
echo.
echo =================================================================
echo  [2/2] Iniciando servidor en modo producción...
echo  * Tienda: http://localhost:8080
echo  * Panel Admin: http://localhost:8080/admin
echo  * Punto de Venta (POS): http://localhost:8080/pos
echo.
echo  Presione CTRL+C y confirme con 'S' para detener el servidor.
echo =================================================================
echo.
call npm start
pause
goto MENU

:SETUP
echo.
echo =================================================================
echo  [✓] Ejecutando configuración inicial (setup.bat)...
echo =================================================================
echo.
call setup.bat
pause
goto MENU

:WIDGET
echo.
echo =================================================================
echo  [✓] Iniciando Widget de Escritorio (Electron)...
echo =================================================================
echo.
cd /d "%PROJECT_DIR%widget-desktop"
if not exist "node_modules\" (
    echo [ADVERTENCIA] No se detectó la carpeta 'node_modules' del widget.
    echo Instalando dependencias del widget primero...
    call npm install
)
start "" node_modules\electron\dist\electron.exe .
cd /d "%PROJECT_DIR%"
goto MENU

:EXIT
echo.
echo ¡Gracias por usar REXERMI Marketplace! Cerrando...
timeout /t 3 >nul
exit /b 0

:: =================================================================
:: FUNCIÓN DE COMPROBACIÓN DE REQUISITOS
:: =================================================================
:CHECK_PRE_REQUISITES
where node >nul 2>&1
if !ERRORLEVEL! neq 0 (
    echo.
    echo [ERROR] Node.js no está instalado o no se encuentra en el PATH.
    echo Por favor, descárguelo e instálelo desde https://nodejs.org/
    echo.
    pause
    exit /b 1
)

if not exist ".env.local" (
    if exist ".env.example" (
        echo [INFO] Creando archivo de configuración '.env.local' desde plantilla...
        copy ".env.example" ".env.local" >nul
        echo [✓] Archivo '.env.local' creado con éxito.
    ) else (
        echo [ADVERTENCIA] No se encontró '.env.example' ni '.env.local'.
        echo Es posible que falten variables de entorno críticas.
    )
)

if not exist "node_modules\" (
    echo.
    echo [ADVERTENCIA] No se detectó la carpeta 'node_modules'.
    echo Es necesario instalar las dependencias antes de iniciar el servidor.
    echo.
    set /p pre_install="¿Desea ejecutar el instalador (setup.bat) ahora? (S/N): "
    if /i "!pre_install!"=="S" (
        call setup.bat
        exit /b 0
    ) else (
        echo Operación cancelada. Regresando al menú principal.
        pause
        exit /b 1
    )
)

exit /b 0
