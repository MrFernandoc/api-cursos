# 📚 API de Cursos Virtuales - Proyecto Final CS2032

## 🎓 Información Académica

**Universidad:** Universidad de Ingeniería y Tecnología (UTEC)  
**Curso:** CS2032 - Cloud Computing (Ciclo 2025-1)  
**Proyecto:** Final - Semanas 11-15 (Exposición Semana 16)  
**Tipo:** Grupo 5 - Cursos Virtuales (Referencia: [Udemy](https://www.udemy.com/))  
**Desarrollador:** Fernando Aguilar  
**Email:** segundo.aguilar@utec.edu.pe  

---

## 🚀 Descripción del Proyecto

API Serverless Multi-tenant para la gestión completa de cursos virtuales, desarrollada como parte del proyecto final del curso CS2032. La aplicación implementa una arquitectura moderna basada en microservicios utilizando AWS Lambda, API Gateway y DynamoDB.

### 🎯 Objetivos Cumplidos

✅ **Backend (6 puntos)**
- Microservicio Multi-tenancy y Serverless en Node.js
- Integración con DynamoDB para persistencia
- Sistema completo CRUD para gestión de cursos
- Protección mediante tokens JWT
- Despliegue automatizado en múltiples stages (dev, test, prod)
- Documentación completa con Swagger/OpenAPI 3.0

---

## 📖 Documentación de la API

### 🌐 Documentación Interactiva

**📋 [Ver Documentación Completa en SwaggerHub](https://app.swaggerhub.com/apis-docs/utec-e9b/api-cursos/1.0.0)**

La documentación incluye:
- 📝 Especificaciones detalladas de todos los endpoints
- 🧪 Interfaz interactiva para probar la API
- 📊 Ejemplos de requests y responses
- 🔐 Información de autenticación y seguridad
- 📚 Esquemas de datos completos

### 🔗 Enlaces Adicionales

- **Repositorio:** [github.com/MrFernandoc/api-cursos](https://github.com/MrFernandoc/api-cursos)
- **Swagger YAML:** [swagger.yml](./swagger.yml)

---

## 🏗️ Arquitectura Técnica

### **Stack Tecnológico**
- **Framework:** Serverless Framework
- **Runtime:** Node.js 18.x
- **Cloud Provider:** Amazon Web Services (AWS)
- **Base de Datos:** DynamoDB con Global Secondary Index
- **Autenticación:** JWT Multi-tenant
- **Documentación:** OpenAPI 3.0 / Swagger

### **Servicios AWS Utilizados**
- **AWS Lambda:** Funciones serverless para la lógica de negocio
- **API Gateway:** Gestión de endpoints REST
- **DynamoDB:** Base de datos NoSQL para persistencia
- **IAM:** Gestión de permisos y roles

### **Arquitectura Multi-tenant**
- Aislamiento de datos por `tenant_id`
- Autenticación centralizada via API externa
- Escalabilidad automática por tenant

---

## 🔗 Endpoints Disponibles

**Base URL:** `https://r9ttk3it54.execute-api.us-east-1.amazonaws.com/dev`

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| POST | `/cursos/crear` | Crear nuevo curso | 🔒 JWT Required |
| GET | `/cursos/listar` | Listar cursos (paginado) | 🔒 JWT Required |
| GET | `/cursos/buscar/{curso_id}` | Buscar curso por ID | 🔒 JWT Required |
| PUT | `/cursos/modificar/{curso_id}` | Modificar curso existente | 🔒 JWT Required |
| DELETE | `/cursos/eliminar/{curso_id}` | Eliminar curso | 🔒 JWT Required |
| POST | `/cursos/poblar` | Poblar datos de prueba | 🔒 JWT Required |

---

## 🔐 Autenticación

Todos los endpoints requieren un token JWT válido obtenido desde la API de usuarios externa.

### **Header Requerido:**
```http
Authorization: Bearer <tu-token-jwt>
```

### **API de Usuarios Externa:**
```
Base URL: https://c0fmkco8rb.execute-api.us-east-1.amazonaws.com/dev
Endpoint de validación: /usuario/validar
```

---

## 💻 Uso de la API

### **Ejemplo: Listar Cursos**
```bash
curl -X GET \
  "https://r9ttk3it54.execute-api.us-east-1.amazonaws.com/dev/cursos/listar?limit=5" \
  -H "Authorization: Bearer tu-token-jwt" \
  -H "Content-Type: application/json"
```

### **Ejemplo: Crear Curso**
```bash
curl -X POST \
  "https://r9ttk3it54.execute-api.us-east-1.amazonaws.com/dev/cursos/crear" \
  -H "Authorization: Bearer tu-token-jwt" \
  -H "Content-Type: application/json" \
  -d '{
    "curso_datos": {
      "nombre": "React.js Profesional",
      "descripcion": "Curso completo de React.js con Hooks y Context API",
      "nivel": "Avanzado",
      "duracion_horas": 60,
      "precio": 299.99,
      "publicado": true,
      "etiquetas": ["react", "javascript", "frontend", "hooks"],
      "instructor": "Ana García López"
    }
  }'
```

### **Ejemplo: Buscar Curso**
```bash
curl -X GET \
  "https://r9ttk3it54.execute-api.us-east-1.amazonaws.com/dev/cursos/buscar/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer tu-token-jwt"
```

---

## 🚀 Despliegue

### **Prerrequisitos**
- Node.js 18.x o superior
- AWS CLI configurado
- Serverless Framework instalado globalmente

### **Instalación**
```bash
# Clonar repositorio
git clone https://github.com/MrFernandoc/api-cursos.git
cd api-cursos

# Instalar dependencias
npm install

# Instalar Serverless Framework (si no está instalado)
npm install -g serverless
```

### **Despliegue a AWS**
```bash
# Desplegar a desarrollo
serverless deploy

# Desplegar a un stage específico
serverless deploy --stage test
serverless deploy --stage prod

# Ver información del despliegue
serverless info
```

### **Stages Disponibles**
- **dev:** Ambiente de desarrollo
- **test:** Ambiente de pruebas
- **prod:** Ambiente de producción

---

## 📊 Características Principales

### **🔒 Seguridad**
- Autenticación JWT obligatoria en todos los endpoints
- Validación externa de tokens
- Aislamiento de datos multi-tenant
- Manejo seguro de errores sin exposición de información sensible

### **📈 Escalabilidad**
- Arquitectura serverless con escalamiento automático
- Base de datos DynamoDB con capacidad bajo demanda
- Optimización con Global Secondary Index para consultas eficientes

### **🛠️ Funcionalidades**
- CRUD completo para gestión de cursos
- Paginación inteligente en listados
- Búsqueda por ID con validación de pertenencia al tenant
- Función de poblado automático para testing
- Validaciones robustas de entrada

### **📋 Datos de Curso**
```json
{
  "curso_datos": {
    "nombre": "string (requerido)",
    "descripcion": "string",
    "nivel": "Básico|Intermedio|Avanzado",
    "duracion_horas": "number",
    "precio": "number (float)",
    "publicado": "boolean",
    "etiquetas": ["array", "de", "strings"],
    "instructor": "string",
    "fecha_modificacion": "ISO Date (auto)"
  }
}
```

---

## 🗄️ Estructura de Base de Datos

### **Tabla Principal: `{stage}-t_cursos`**

#### **Claves Primarias:**
- **Partition Key:** `tenant_id` (String)
- **Sort Key:** `curso_id` (String - UUID)

#### **Atributos:**
- `tenant_id`: Identificador del tenant
- `curso_id`: Identificador único del curso (UUID)
- `curso_datos`: Objeto con toda la información del curso
- `fecha_creacion`: Timestamp de creación (ISO String)

#### **Índices Secundarios:**
- **CursosPorFechaIndex:** Permite consultas ordenadas por fecha de creación
  - Partition Key: `tenant_id`
  - Sort Key: `fecha_creacion`

---

## 🧪 Testing y Datos de Prueba

### **Función de Poblado**
La API incluye un endpoint especial para generar datos de prueba:

```bash
# Poblar 10 cursos por defecto
curl -X POST \
  "https://r9ttk3it54.execute-api.us-east-1.amazonaws.com/dev/cursos/poblar" \
  -H "Authorization: Bearer tu-token-jwt"

# Poblar cantidad específica
curl -X POST \
  "https://r9ttk3it54.execute-api.us-east-1.amazonaws.com/dev/cursos/poblar" \
  -H "Authorization: Bearer tu-token-jwt" \
  -H "Content-Type: application/json" \
  -d '{"cantidad": 25}'
```

### **Datos Generados**
- Cursos secuenciales: "Programación 1", "Programación 2", etc.
- Niveles progresivos: Básico (1-10), Intermedio (11-20), Avanzado (21+)
- Precios escalables: Base $49.99 + ($5 × número)
- Duraciones variables: Base 20h + (2h × número)

---

## 📝 Estructura del Proyecto

```
api-cursos/
├── serverless.yml              # Configuración de Serverless Framework
├── swagger.yml                 # Documentación OpenAPI 3.0
├── package.json               # Dependencias y scripts
├── README.md                  # Este archivo
├── src/
│   ├── handlers/              # Funciones Lambda
│   │   ├── crearCurso.js      # POST /cursos/crear
│   │   ├── listarCursos.js    # GET /cursos/listar
│   │   ├── buscarCurso.js     # GET /cursos/buscar/{id}
│   │   ├── modificarCurso.js  # PUT /cursos/modificar/{id}
│   │   ├── eliminarCurso.js   # DELETE /cursos/eliminar/{id}
│   │   └── poblarCursos.js    # POST /cursos/poblar
│   ├── middlewares/
│   │   └── authMiddleware.js  # Validación JWT externa
│   └── utils/
│       └── response.js        # Utilidades para respuestas HTTP
└── .gitignore
```

---

## 🔧 Configuración del Proyecto

### **Variables de Entorno**
```yaml
# serverless.yml
environment:
  TABLE_NAME: ${sls:stage}-t_cursos
```

### **Configuración DynamoDB**
```yaml
# Tabla con configuración óptima
BillingMode: PAY_PER_REQUEST    # Escalamiento automático
StreamSpecification:            # Para futuras integraciones
  StreamViewType: NEW_AND_OLD_IMAGES
```

---

## 📈 Métricas y Monitoreo

### **Funciones Desplegadas**
- ✅ 6 funciones Lambda activas
- 📦 Tamaño: 24 MB cada función
- ⚡ Runtime: Node.js 18.x
- 🌎 Región: us-east-1

### **Performance**
- **Timeout:** 29 segundos por función
- **Memoria:** 1024 MB por función
- **Concurrencia:** Ilimitada (AWS Lambda)

---

## 🎓 Cumplimiento de Requisitos Académicos

### **✅ Backend (6 puntos) - COMPLETADO**
- [x] Microservicio Multi-tenancy y Serverless
- [x] Node.js con DynamoDB
- [x] Operaciones: Listar (paginado), Crear, Buscar, Modificar, Eliminar
- [x] Protección con tokens JWT
- [x] Despliegue automatizado en 3 stages
- [x] Documentación con Swagger UI

### **🏗️ Arquitectura Implementada**
- **Multi-tenancy:** ✅ Implementado via `tenant_id`
- **Serverless:** ✅ AWS Lambda + API Gateway
- **Documentación:** ✅ OpenAPI 3.0 completa en SwaggerHub

---

## 📞 Contacto y Soporte

**Desarrollador:** Segundo Aguilar  
**Email:** segundo.aguilar@utec.edu.pe  
**GitHub:** [@MrFernandoc](https://github.com/MrFernandoc)  
**Universidad:** UTEC - Universidad de Ingeniería y Tecnología  

### **📋 Enlaces Importantes**
- 📖 **Documentación API:** [SwaggerHub](https://app.swaggerhub.com/apis-docs/utec-e9b/api-cursos/1.0.0)
- 💻 **Repositorio:** [GitHub](https://github.com/MrFernandoc/api-cursos)
- 🎓 **Curso:** CS2032 - Cloud Computing

---

## 📄 Licencia

Este proyecto es desarrollado con fines académicos como parte del curso CS2032 - Cloud Computing de la Universidad de Ingeniería y Tecnología (UTEC).

---

### 🔗 Para Probar la API

1. **Ver Documentación:** [SwaggerHub](https://app.swaggerhub.com/apis-docs/utec-e9b/api-cursos/1.0.0)
2. **Obtener Token JWT:** Usar la API de usuarios externa
3. **Probar Endpoints:** Usar la interfaz "Try it out" en SwaggerHub
4. **Revisar Código:** Explorar el repositorio en GitHub

---

**🎯 Proyecto desarrollado para demostrar competencias en Cloud Computing, arquitecturas serverless y desarrollo de APIs RESTful en AWS.**