#!/bin/bash

# REXERMI Marketplace - Linux LXC Setup & Deploy
# ----------------------------------------------

echo "==================================================="
echo "  REXERMI Marketplace - Linux setup & Deploy"
echo "==================================================="
echo

# 1. Check Node.js and NPM
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js no está instalado. Por favor, instálalo."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "[ERROR] NPM no está instalado. Por favor, instálalo."
    exit 1
fi

echo "[✓] Node.js detectado: $(node -v)"
echo "[✓] NPM detectado: $(npm -v)"
echo

# 2. Create Required Directories
echo "[1/4] Creando directorios necesarios..."
mkdir -p src/data
mkdir -p public/assets/uploads
mkdir -p private/receipts
echo "  [+] Directorios verificados y creados."
echo

# 3. Configure Local Environment Variables
echo "[2/4] Configurando variables de entorno (.env.local)..."
if [ ! -f .env.local ]; then
    cp .env.example .env.local
    echo "  [+] Creado .env.local desde plantilla .env.example"
    echo "  [!] ATENCION: Edita .env.local e introduce un JWT_SECRET robusto."
else
    echo "  [~] .env.local ya existe. Saltando creación."
fi
echo

# 4. Clean Install Dependencies
echo "[3/4] Instalando dependencias del proyecto (npm install)..."
npm install
if [ $? -ne 0 ]; then
    echo "[ERROR] Hubo un problema al instalar las dependencias."
    exit 1
fi
echo "[✓] Dependencias instaladas correctamente."
echo

# 5. Compile next.js app
echo "[4/4] Construyendo aplicación optimizada para producción (npm run build)..."
npm run build
if [ $? -ne 0 ]; then
    echo "[ERROR] Error de compilación en Next.js."
    exit 1
fi
echo "[✓] Compilación completada con éxito."
echo

# 6. Set Directory Permissions (Critical for LXC / Linux Web Server writing permissions)
echo "Configurando permisos de escritura para directorios de almacenamiento..."
# Permitir lectura/escritura/ejecución al propietario y al grupo de los directorios de carga y base de datos
chmod -R 775 public/assets/uploads private/receipts src/data

# Intentar detectar el usuario del servidor web de Linux para transferir la propiedad si corre como superusuario
if [ "$EUID" -eq 0 ]; then
    # Estamos ejecutando como root, podemos cambiar la propiedad al grupo www-data si existe
    if getent group www-data > /dev/null; then
        chown -R :www-data public/assets/uploads private/receipts src/data
        echo "  [✓] Propietario de grupo establecido a 'www-data' para almacenamiento local."
    fi
fi

echo
echo "==================================================="
echo "  REXERMI Marketplace - CONFIGURACION COMPLETADA"
echo "==================================================="
echo
echo "  * URL de la Tienda: http://localhost:8080"
echo "  * Panel de Control Admin: http://localhost:8080/admin"
echo "  * Terminal Punto de Venta: http://localhost:8080/pos"
echo "  * Widget de Control: http://localhost:8080/admin-control-widget.html"
echo
echo "Para iniciar el servidor de desarrollo ejecuta: npm run dev"
echo "Para iniciar el servidor de producción ejecuta: npm start"
echo
exit 0
