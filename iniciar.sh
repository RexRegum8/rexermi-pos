#!/bin/bash

# Guardar el directorio raíz del proyecto
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

show_menu() {
    clear
    echo "================================================================="
    echo "       REXERMI Marketplace - Iniciador del Servidor"
    echo "================================================================="
    echo
    echo "  [1] Iniciar en Modo Desarrollo (npm run dev)"
    echo "      - Recomendado para pruebas y desarrollo."
    echo "      - Recarga automática cuando editas el código."
    echo
    echo "  [2] Iniciar en Modo Producción (npm start)"
    echo "      - Ejecuta el servidor optimizado para mejor rendimiento."
    echo "      - Requiere haber compilado el proyecto previamente (Opción 3)."
    echo
    echo "  [3] Compilar y Iniciar en Modo Producción (npm run build + start)"
    echo "      - Compila la aplicación con los cambios más recientes"
    echo "        y luego la inicia de forma optimizada."
    echo
    echo "  [4] Ejecutar Configuración Inicial (setup.sh)"
    echo "      - Instala dependencias, crea carpetas necesarias y compila."
    echo
    echo "  [5] Iniciar Widget de Escritorio (Electron)"
    echo "      - Abre el monitor de estado de hardware y controles del servidor."
    echo
    echo "  [6] Salir"
    echo
    echo "================================================================="
    echo
    read -p "Elija una opción (1-6) y presione Enter: " opcion
}

check_pre_requisites() {
    if ! command -v node &> /dev/null; then
        echo
        echo "[ERROR] Node.js no está instalado o no se encuentra en el PATH."
        echo "Por favor, instálelo desde https://nodejs.org/"
        echo
        read -p "Presione Enter para continuar..." temp
        return 1
    fi

    if [ ! -f .env.local ]; then
        if [ -f .env.example ]; then
            echo "[INFO] Creando archivo de configuración '.env.local' desde plantilla..."
            cp .env.example .env.local
            echo "[✓] Archivo '.env.local' creado con éxito."
        else
            echo "[ADVERTENCIA] No se encontró '.env.example' ni '.env.local'."
            echo "Es posible que falten variables de entorno críticas."
        fi
    fi

    if [ ! -d node_modules ]; then
        echo
        echo "[ADVERTENCIA] No se detectó la carpeta 'node_modules'."
        echo "Es necesario instalar las dependencias antes de iniciar el servidor."
        echo
        read -p "¿Desea ejecutar el instalador (setup.sh) ahora? (S/N): " pre_install
        if [[ "$pre_install" =~ ^[Ss]$ ]]; then
            chmod +x setup.sh
            ./setup.sh
            return 0
        else
            echo "Operación cancelada. Regresando al menú principal."
            read -p "Presione Enter para continuar..." temp
            return 1
        fi
    fi
    return 0
}

while true; do
    show_menu
    case $opcion in
        1)
            if check_pre_requisites; then
                echo
                echo "================================================================="
                echo "  [✓] Iniciando servidor de desarrollo..."
                echo "  * Tienda: http://localhost:8080"
                echo "  * Panel Admin: http://localhost:8080/admin"
                echo "  * Punto de Venta (POS): http://localhost:8080/pos"
                echo
                echo "  Presione CTRL+C para detener el servidor."
                echo "================================================================="
                echo
                npm run dev
                echo
                read -p "Servidor detenido. Presione Enter para continuar..." temp
            fi
            ;;
        2)
            if check_pre_requisites; then
                echo
                echo "================================================================="
                echo "  [✓] Iniciando servidor en modo producción..."
                echo "  * Tienda: http://localhost:8080"
                echo "  * Panel Admin: http://localhost:8080/admin"
                echo "  * Punto de Venta (POS): http://localhost:8080/pos"
                echo
                echo "  Presione CTRL+C para detener el servidor."
                echo "================================================================="
                echo
                npm start
                if [ $? -ne 0 ]; then
                    echo
                    echo "[ERROR] No se pudo iniciar el servidor."
                    echo "¿Ha compilado el proyecto previamente? Intente usar la Opción [3]."
                    echo
                    read -p "Presione Enter para continuar..." temp
                fi
            fi
            ;;
        3)
            if check_pre_requisites; then
                echo
                echo "================================================================="
                echo "  [1/2] Compilando la aplicación para producción (npm run build)..."
                echo "================================================================="
                echo
                npm run build
                if [ $? -ne 0 ]; then
                    echo
                    echo "[ERROR] Error durante la compilación."
                    read -p "Presione Enter para continuar..." temp
                    continue
                fi
                echo
                echo "================================================================="
                echo "  [2/2] Iniciando servidor en modo producción..."
                echo "  * Tienda: http://localhost:8080"
                echo "  * Panel Admin: http://localhost:8080/admin"
                echo "  * Punto de Venta (POS): http://localhost:8080/pos"
                echo
                echo "  Presione CTRL+C para detener el servidor."
                echo "================================================================="
                echo
                npm start
                read -p "Presione Enter para continuar..." temp
            fi
            ;;
        4)
            echo
            echo "================================================================="
            echo "  [✓] Ejecutando configuración inicial (setup.sh)..."
            echo "================================================================="
            echo
            chmod +x setup.sh
            ./setup.sh
            read -p "Presione Enter para continuar..." temp
            ;;
        5)
            echo
            echo "================================================================="
            echo "  [✓] Iniciando Widget de Escritorio (Electron)..."
            echo "================================================================="
            echo
            cd "$PROJECT_DIR/widget-desktop"
            if [ ! -d node_modules ]; then
                echo "[ADVERTENCIA] No se detectó la carpeta 'node_modules' del widget."
                echo "Instalando dependencias del widget primero..."
                npm install
            fi
            # Iniciar npm start en segundo plano
            npm start &
            cd "$PROJECT_DIR"
            read -p "Widget iniciado en segundo plano. Presione Enter para continuar..." temp
            ;;
        6)
            echo
            echo "¡Gracias por usar REXERMI Marketplace! Cerrando..."
            sleep 1
            exit 0
            ;;
        *)
            ;;
    esac
done
