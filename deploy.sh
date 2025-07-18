#!/bin/bash

# 🎯 API CURSOS - SCRIPT DE DESPLIEGUE PROFESIONAL
# Proyecto: CS2032 - Cloud Computing (UTEC)
# Autor: Fernando Aguilar
# =======================================================

# 🎨 Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# 📋 Configuración
SERVICE_NAME="API Cursos"
PROJECT="CS2032 - Cloud Computing"
STAGES=("dev" "test" "prod")
CURRENT_DIR=$(pwd)
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# 🎭 Funciones de UI
print_header() {
    echo -e "\n${CYAN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${WHITE}  🚀 ${SERVICE_NAME} - Sistema de Despliegue Automatizado${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  📅 ${TIMESTAMP}${NC}"
    echo -e "${YELLOW}  🎓 ${PROJECT}${NC}"
    echo -e "${YELLOW}  📁 $(basename $CURRENT_DIR)${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}\n"
}

print_stage_header() {
    local stage=$1
    local emoji=""
    local color=""
    
    case $stage in
        "dev")
            emoji="🔧"
            color=$BLUE
            ;;
        "test")
            emoji="🧪"
            color=$YELLOW
            ;;
        "prod")
            emoji="🏭"
            color=$RED
            ;;
    esac
    
    echo -e "\n${color}┌─────────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${color}│  ${emoji} DESPLEGANDO EN ${stage^^}                                        │${NC}"
    echo -e "${color}└─────────────────────────────────────────────────────────────────┘${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

print_step() {
    echo -e "${PURPLE}📋 $1${NC}"
}

show_spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='|/-\'
    while [ "$(ps a | awk '{print $1}' | grep $pid)" ]; do
        local temp=${spinstr#?}
        printf " [%c]  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
}

# 🔍 Validaciones
check_prerequisites() {
    print_step "Verificando prerrequisitos..."
    
    # Verificar Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js no está instalado"
        exit 1
    fi
    
    # Verificar Serverless Framework
    if ! command -v serverless &> /dev/null && ! command -v sls &> /dev/null; then
        print_error "Serverless Framework no está instalado"
        echo -e "${YELLOW}Instálalo con: npm install -g serverless${NC}"
        exit 1
    fi
    
    # Verificar AWS CLI
    if ! command -v aws &> /dev/null; then
        print_warning "AWS CLI no está instalado (opcional)"
    fi
    
    # Verificar package.json
    if [ ! -f "package.json" ]; then
        print_error "package.json no encontrado"
        exit 1
    fi
    
    # Verificar serverless.yml
    if [ ! -f "serverless.yml" ]; then
        print_error "serverless.yml no encontrado"
        exit 1
    fi
    
    print_success "Todos los prerrequisitos OK"
}

# 📦 Instalación de dependencias
install_dependencies() {
    print_step "Verificando dependencias..."
    
    if [ ! -d "node_modules" ]; then
        print_info "Instalando dependencias..."
        npm install --silent
        if [ $? -eq 0 ]; then
            print_success "Dependencias instaladas correctamente"
        else
            print_error "Error al instalar dependencias"
            exit 1
        fi
    else
        print_success "Dependencias ya están instaladas"
    fi
}

# 🚀 Función de despliegue
deploy_stage() {
    local stage=$1
    local start_time=$(date +%s)
    
    print_stage_header $stage
    
    print_info "Iniciando despliegue en $stage..."
    
    # Ejecutar despliegue
    echo -e "${CYAN}Ejecutando: ${WHITE}sls deploy --stage $stage${NC}"
    
    if sls deploy --stage $stage; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_success "Despliegue en $stage completado exitosamente ($duration segundos)"
        
        # Mostrar información del despliegue
        print_info "Obteniendo información del despliegue..."
        echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"
        sls info --stage $stage
        echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"
        
        return 0
    else
        print_error "Error en el despliegue de $stage"
        return 1
    fi
}

# 📊 Función de resumen
show_summary() {
    local deployed_stages=("$@")
    
    echo -e "\n${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    🎉 RESUMEN DE DESPLIEGUES                    ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
    
    for stage in "${deployed_stages[@]}"; do
        echo -e "${GREEN}✅ ${stage^^}: Desplegado exitosamente${NC}"
    done
    
    echo -e "\n${CYAN}📋 URLs de los endpoints:${NC}"
    for stage in "${deployed_stages[@]}"; do
        echo -e "${YELLOW}${stage^^}: ${WHITE}https://[api-id].execute-api.us-east-1.amazonaws.com/$stage${NC}"
    done
    
    echo -e "\n${PURPLE}🔧 Comandos útiles:${NC}"
    echo -e "${CYAN}• Ver logs:${NC} sls logs -f crearCurso --stage [stage]"
    echo -e "${CYAN}• Ver info:${NC} sls info --stage [stage]"
    echo -e "${CYAN}• Remover:${NC} sls remove --stage [stage]"
}

# 🎯 Menú principal
show_menu() {
    echo -e "\n${CYAN}🎯 Selecciona una opción:${NC}"
    echo -e "${WHITE}[1]${NC} Desplegar solo DEV"
    echo -e "${WHITE}[2]${NC} Desplegar solo TEST"
    echo -e "${WHITE}[3]${NC} Desplegar solo PROD"
    echo -e "${WHITE}[4]${NC} Desplegar DEV + TEST"
    echo -e "${WHITE}[5]${NC} Desplegar TEST + PROD"
    echo -e "${WHITE}[6]${NC} Desplegar TODOS (DEV + TEST + PROD)"
    echo -e "${WHITE}[7]${NC} Ver información de despliegues"
    echo -e "${WHITE}[8]${NC} Salir"
    echo -e "\n${YELLOW}Ingresa tu opción [1-8]: ${NC}"
}

# 📋 Función para mostrar info
show_info() {
    print_step "Información de despliegues actuales:"
    
    for stage in "${STAGES[@]}"; do
        echo -e "\n${CYAN}📊 Información de $stage:${NC}"
        echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"
        if sls info --stage $stage 2>/dev/null; then
            echo -e "${GREEN}✅ $stage está desplegado${NC}"
        else
            echo -e "${YELLOW}⚠️  $stage no está desplegado${NC}"
        fi
        echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"
    done
}

# 🎯 Función principal
main() {
    print_header
    check_prerequisites
    install_dependencies
    
    while true; do
        show_menu
        read -r choice
        
        case $choice in
            1)
                deploy_stage "dev"
                deployed_stages=("dev")
                show_summary "${deployed_stages[@]}"
                ;;
            2)
                deploy_stage "test"
                deployed_stages=("test")
                show_summary "${deployed_stages[@]}"
                ;;
            3)
                print_warning "⚠️  Vas a desplegar en PRODUCCIÓN"
                echo -e "${YELLOW}¿Estás seguro? [y/N]: ${NC}"
                read -r confirm
                if [[ $confirm =~ ^[Yy]$ ]]; then
                    deploy_stage "prod"
                    deployed_stages=("prod")
                    show_summary "${deployed_stages[@]}"
                else
                    print_info "Despliegue cancelado"
                fi
                ;;
            4)
                deployed_stages=()
                if deploy_stage "dev"; then
                    deployed_stages+=("dev")
                fi
                if deploy_stage "test"; then
                    deployed_stages+=("test")
                fi
                show_summary "${deployed_stages[@]}"
                ;;
            5)
                deployed_stages=()
                if deploy_stage "test"; then
                    deployed_stages+=("test")
                fi
                print_warning "⚠️  Vas a desplegar en PRODUCCIÓN"
                echo -e "${YELLOW}¿Estás seguro? [y/N]: ${NC}"
                read -r confirm
                if [[ $confirm =~ ^[Yy]$ ]]; then
                    if deploy_stage "prod"; then
                        deployed_stages+=("prod")
                    fi
                fi
                show_summary "${deployed_stages[@]}"
                ;;
            6)
                print_warning "⚠️  Vas a desplegar en TODOS los ambientes incluyendo PRODUCCIÓN"
                echo -e "${YELLOW}¿Estás seguro? [y/N]: ${NC}"
                read -r confirm
                if [[ $confirm =~ ^[Yy]$ ]]; then
                    deployed_stages=()
                    for stage in "${STAGES[@]}"; do
                        if deploy_stage "$stage"; then
                            deployed_stages+=("$stage")
                        fi
                    done
                    show_summary "${deployed_stages[@]}"
                else
                    print_info "Despliegue cancelado"
                fi
                ;;
            7)
                show_info
                ;;
            8)
                echo -e "\n${GREEN}👋 ¡Hasta luego!${NC}"
                echo -e "${CYAN}🎓 Proyecto CS2032 - Cloud Computing${NC}\n"
                exit 0
                ;;
            *)
                print_error "Opción inválida. Por favor selecciona 1-8"
                ;;
        esac
        
        echo -e "\n${CYAN}Presiona Enter para continuar...${NC}"
        read -r
    done
}

# 🚀 Ejecutar script
main "$@"