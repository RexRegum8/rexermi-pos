@echo off
set GIT_PATH="C:\Users\jdlva\AppData\Local\Microsoft\WinGet\Packages\Git.MinGit_Microsoft.Winget.Source_8wekyb3d8bbwe\cmd\git.exe"
set GH_PATH="C:\Users\jdlva\AppData\Local\Microsoft\WinGet\Packages\GitHub.cli_Microsoft.Winget.Source_8wekyb3d8bbwe\bin\gh.exe"

echo ===================================================
echo   Subir codigo de Rexermi POS a GitHub
echo ===================================================
echo.

%GH_PATH% auth status >nul 2>&1
if %errorlevel% neq 0 (
    echo [1/3] No has iniciado sesion en GitHub.
    echo Iniciando proceso de inicio de sesion...
    echo.
    echo Pasos recomendados:
    echo 1. Selecciona: GitHub.com
    echo 2. Selecciona: HTTPS
    echo 3. Selecciona: Yes
    echo 4. Selecciona: Login with a web browser
    echo.
    echo Presiona una tecla para continuar...
    pause > nul
    %GH_PATH% auth login
) else (
    echo [1/3] Ya tienes sesion iniciada en GitHub.
)

echo.
echo [2/3] Configurando credenciales de Git con GitHub...
%GH_PATH% auth setup-git

echo.
echo [3/3] Subiendo codigo a GitHub...
%GIT_PATH% remote remove origin >nul 2>&1
%GIT_PATH% remote add origin https://github.com/RexRegum8/rexermi-pos.git
%GIT_PATH% push -u origin main

echo.
echo ===================================================
echo   ?Codigo subido con exito a GitHub!
echo ===================================================
echo.
pause
