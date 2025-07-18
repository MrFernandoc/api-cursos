const { faker } = require('@faker-js/faker');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { validarTokenExternamente } = require('../middlewares/authMiddleware');
const { createResponse } = require('../utils/response');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME;

// 🎯 CATEGORÍAS que coinciden con tu frontend
const CATEGORIAS = [
  'Programación',
  'Diseño', 
  'Marketing',
  'Negocios',
  'Desarrollo Personal',
  'Idiomas',
  'Ciencias',
  'Arte',
  'Música',
  'Fotografía'
];

// 🎭 ESTADOS que coinciden con tu frontend
const ESTADOS = ['Activo', 'Inactivo', 'Borrador'];

// 👨‍🏫 INSTRUCTORES realistas
const INSTRUCTORES = [
  'Fernando Herrera',
  'Ana García López',
  'Carlos Mendoza Silva',
  'María Fernández Torres',
  'Luis Rodriguez Pérez',
  'Sofia Martinez Ruiz',
  'Diego Gonzalez Castro',
  'Laura Jiménez Moreno',
  'Roberto Silva Vargas',
  'Carmen López Díaz',
  'Miguel Angel Reyes',
  'Patricia Morales Cruz',
  'Alejandro Vega Soto',
  'Isabella Ramírez Luna',
  'Daniel Torres Aguilar'
];

// 🎓 DATOS DE CURSOS POR CATEGORÍA
const CURSOS_POR_CATEGORIA = {
  'Programación': [
    'Fundamentos de JavaScript ES6+',
    'React.js desde Cero hasta Experto',
    'Node.js y Express para Backend',
    'Python para Ciencia de Datos',
    'Desarrollo Full Stack con MERN',
    'Vue.js 3 Composition API',
    'TypeScript para Desarrolladores',
    'AWS Lambda y Serverless',
    'Docker y Kubernetes Práctico',
    'GraphQL con Apollo Server',
    'Next.js para Aplicaciones Web',
    'Flutter y Dart Móvil',
    'Spring Boot con Java',
    'Angular 15 Completo',
    'PHP Laravel Moderno'
  ],
  'Diseño': [
    'Adobe Photoshop Profesional',
    'Illustrator para Logos y Branding',
    'Figma UI/UX Design',
    'Diseño Web Responsivo',
    'After Effects para Motion Graphics',
    'InDesign Editorial',
    'Blender 3D Modeling',
    'Canva para No Diseñadores',
    'Sketch para Interfaces',
    'Adobe XD Prototyping'
  ],
  'Marketing': [
    'Marketing Digital Completo',
    'Google Ads Desde Cero',
    'Facebook e Instagram Ads',
    'SEO Optimización Web',
    'Email Marketing Efectivo',
    'Content Marketing Strategy',
    'Social Media Management',
    'Analytics y Métricas',
    'Copywriting Persuasivo',
    'Influencer Marketing'
  ],
  'Negocios': [
    'Emprendimiento y Startups',
    'Gestión de Proyectos Ágiles',
    'Finanzas Personales',
    'Liderazgo Empresarial',
    'Ventas y Negociación',
    'Business Intelligence',
    'Excel Avanzado para Negocios',
    'Plan de Negocios Exitoso',
    'E-commerce desde Cero',
    'Gestión del Tiempo'
  ],
  'Desarrollo Personal': [
    'Inteligencia Emocional',
    'Productividad Personal',
    'Hablar en Público',
    'Mindfulness y Meditación',
    'Coaching Personal',
    'Pensamiento Crítico',
    'Gestión del Estrés',
    'Creatividad e Innovación',
    'Autoestima y Confianza',
    'Hábitos Exitosos'
  ],
  'Idiomas': [
    'Inglés de Negocios',
    'Francés Conversacional',
    'Alemán desde Cero',
    'Italiano para Viajeros',
    'Portugués Brasileño',
    'Mandarín Básico',
    'Japonés para Principiantes',
    'Árabe Moderno',
    'Ruso Elemental',
    'Coreano K-Pop'
  ],
  'Ciencias': [
    'Física Cuántica Básica',
    'Química Orgánica',
    'Biología Molecular',
    'Astronomía para Todos',
    'Matemáticas Aplicadas',
    'Estadística y Probabilidad',
    'Neurociencia Cognitiva',
    'Ecología y Medio Ambiente',
    'Genética Humana',
    'Microbiología'
  ],
  'Arte': [
    'Dibujo Artístico',
    'Pintura al Óleo',
    'Acuarela para Principiantes',
    'Escultura en Arcilla',
    'Arte Digital',
    'Historia del Arte',
    'Técnicas de Grabado',
    'Arte Abstracto',
    'Retrato Realista',
    'Street Art y Graffiti'
  ],
  'Música': [
    'Guitarra Acústica desde Cero',
    'Piano Clásico',
    'Producción Musical Digital',
    'Canto y Técnica Vocal',
    'Batería Rock y Pop',
    'Violín para Principiantes',
    'Composición Musical',
    'DJ y Mezclas',
    'Bajo Eléctrico',
    'Teoría Musical'
  ],
  'Fotografía': [
    'Fotografía Digital DSLR',
    'Lightroom y Edición',
    'Fotografía de Retrato',
    'Fotografía de Paisajes',
    'Fotografía de Bodas',
    'Fotografía Callejera',
    'Iluminación Profesional',
    'Fotografía con Smartphone',
    'Fotografía de Producto',
    'Fotografía Nocturna'
  ]
};

// 🎯 Función principal para generar curso realista
function generarCursoRealista() {
  // Seleccionar categoría aleatoria
  const categoria = faker.helpers.arrayElement(CATEGORIAS);
  
  // Seleccionar nombre del curso según la categoría
  const nombresCursos = CURSOS_POR_CATEGORIA[categoria];
  const nombre = faker.helpers.arrayElement(nombresCursos);
  
  // Generar descripción contextual
  const descripcion = generarDescripcionPorCategoria(categoria, nombre);
  
  // Precio según categoría (algunas son más caras)
  const precio = generarPrecioPorCategoria(categoria);
  
  // Duración según categoría
  const duracion = generarDuracionPorCategoria(categoria);
  
  // Estado con probabilidades realistas
  const estado = faker.helpers.weightedArrayElement([
    { weight: 70, value: 'Activo' },      // 70% activos
    { weight: 20, value: 'Borrador' },    // 20% borradores
    { weight: 10, value: 'Inactivo' }     // 10% inactivos
  ]);
  
  // Instructor aleatorio
  const instructor = faker.helpers.arrayElement(INSTRUCTORES);
  
  // ✅ ESTRUCTURA EXACTA COMO TU FRONTEND - SIN CAMPOS PROBLEMÁTICOS
  return {
    nombre,
    descripcion,
    precio: parseFloat(precio.toFixed(2)),
    categoria,
    instructor,
    duracion_horas: duracion,
    estado
    // ❌ REMOVIDO: nivel, etiquetas, publicado (causan problemas con streamProcessor)
    // ✅ Solo campos que tu frontend envía realmente
  };
}

// 📝 Generar descripción contextual por categoría
function generarDescripcionPorCategoria(categoria, nombre) {
  const descripciones = {
    'Programación': [
      `Domina ${nombre.split(' ')[0]} con este curso completo. Aprende desde los fundamentos hasta técnicas avanzadas con proyectos prácticos y ejercicios reales.`,
      `Conviértete en un experto en ${nombre.split(' ')[0]}. Incluye proyectos del mundo real, buenas prácticas y las últimas tendencias de la industria.`,
      `Curso intensivo de ${nombre.split(' ')[0]} para desarrolladores. Teoria + práctica + proyectos + certificación al finalizar.`
    ],
    'Diseño': [
      `Aprende ${nombre.split(' ')[0]} desde cero hasta nivel profesional. Crea diseños impactantes con técnicas modernas y tendencias actuales.`,
      `Domina las herramientas de ${nombre.split(' ')[0]} y desarrolla tu estilo único. Incluye portfolio de proyectos profesionales.`,
      `Curso práctico de ${nombre.split(' ')[0]} con proyectos reales para clientes. Desarrolla tu creatividad y habilidades técnicas.`
    ],
    'Marketing': [
      `Estrategias de ${nombre.split(' ')[0]} que realmente funcionan. Casos de éxito, herramientas prácticas y metodologías probadas.`,
      `Domina ${nombre.split(' ')[0]} y aumenta tus ventas. Técnicas actualizadas para el mercado digital moderno.`,
      `Curso completo de ${nombre.split(' ')[0]} con casos reales y métricas medibles. ROI garantizado.`
    ],
    'Negocios': [
      `Desarrolla habilidades en ${nombre.split(' ')[0]} para acelerar tu carrera profesional. Casos prácticos y herramientas empresariales.`,
      `Aprende ${nombre.split(' ')[0]} con metodologías empresariales modernas. Aplica inmediatamente en tu trabajo.`,
      `Curso estratégico de ${nombre.split(' ')[0]} para profesionales ambiciosos. Networking y certificación incluidos.`
    ]
  };
  
  const opcionesCategoria = descripciones[categoria] || [
    `Curso completo de ${nombre}. Aprende con expertos de la industria y proyectos prácticos.`,
    `Domina ${nombre} paso a paso. Contenido actualizado y certificación profesional.`,
    `Desarrolla expertise en ${nombre}. Metodología práctica y resultados medibles.`
  ];
  
  return faker.helpers.arrayElement(opcionesCategoria);
}

// 💰 Generar precio según categoría
function generarPrecioPorCategoria(categoria) {
  const rangos = {
    'Programación': { min: 89.99, max: 299.99 },
    'Diseño': { min: 59.99, max: 199.99 },
    'Marketing': { min: 79.99, max: 249.99 },
    'Negocios': { min: 99.99, max: 399.99 },
    'Desarrollo Personal': { min: 39.99, max: 149.99 },
    'Idiomas': { min: 49.99, max: 179.99 },
    'Ciencias': { min: 69.99, max: 229.99 },
    'Arte': { min: 29.99, max: 119.99 },
    'Música': { min: 39.99, max: 159.99 },
    'Fotografía': { min: 59.99, max: 189.99 }
  };
  
  const rango = rangos[categoria] || { min: 49.99, max: 199.99 };
  return faker.number.float({ min: rango.min, max: rango.max });
}

// ⏱️ Generar duración según categoría
function generarDuracionPorCategoria(categoria) {
  const rangos = {
    'Programación': { min: 25, max: 80 },
    'Diseño': { min: 15, max: 50 },
    'Marketing': { min: 10, max: 40 },
    'Negocios': { min: 8, max: 30 },
    'Desarrollo Personal': { min: 5, max: 20 },
    'Idiomas': { min: 20, max: 60 },
    'Ciencias': { min: 12, max: 45 },
    'Arte': { min: 8, max: 35 },
    'Música': { min: 10, max: 40 },
    'Fotografía': { min: 6, max: 25 }
  };
  
  const rango = rangos[categoria] || { min: 10, max: 40 };
  return faker.number.int({ min: rango.min, max: rango.max });
}

// 🚀 Función principal del handler
module.exports.poblarCursos = async (event) => {
  try {
    const token = event.headers.Authorization;
    const payload = await validarTokenExternamente(token);
    const tenant_id = payload.tenant_id;

    let body = {};
    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch (parseError) {
        return createResponse(400, { mensaje: 'El cuerpo de la petición contiene un JSON no válido.' });
      }
    }
    
    const cantidad = body.cantidad || 20; // Aumentamos el default para más variedad

    // 🎯 Validar cantidad
    if (cantidad < 1 || cantidad > 100) {
      return createResponse(400, { 
        mensaje: 'La cantidad debe estar entre 1 y 100 cursos.',
        cantidad_solicitada: cantidad 
      });
    }

    console.log(`🎓 Generando ${cantidad} cursos realistas para tenant: ${tenant_id}`);

    const cursosPromises = [];
    const fechaInicio = new Date();
    const categoriasUsadas = new Set();
    const cursosGenerados = [];

    for (let i = 0; i < cantidad; i++) {
      const curso_id = uuidv4();
      const curso_datos = generarCursoRealista(); // ✅ Genera solo campos compatibles
      
      // Rastrear categorías para el resumen
      categoriasUsadas.add(curso_datos.categoria);
      cursosGenerados.push({
        nombre: curso_datos.nombre,
        categoria: curso_datos.categoria,
        precio: curso_datos.precio,
        estado: curso_datos.estado
      });
      
      // Fechas escalonadas para simular creación real
      const fecha_creacion = new Date(fechaInicio.getTime() - (i * 3600000)).toISOString(); // -1 hora por curso

      const item = {
        tenant_id,
        curso_id,
        curso_datos, // ✅ Estructura EXACTA como tu frontend
        fecha_creacion
      };

      cursosPromises.push(
        dynamodb.put({ TableName: TABLE_NAME, Item: item }).promise()
      );
    }

    // 🚀 Ejecutar todas las inserciones
    await Promise.all(cursosPromises);

    // 📊 Crear resumen detallado
    const resumenPorCategoria = {};
    cursosGenerados.forEach(curso => {
      resumenPorCategoria[curso.categoria] = (resumenPorCategoria[curso.categoria] || 0) + 1;
    });

    const resumen = {
      total_cursos: cantidad,
      categorias_generadas: Object.keys(resumenPorCategoria).sort(),
      cursos_por_categoria: resumenPorCategoria,
      estados_distribucion: {
        activos: cursosGenerados.filter(c => c.estado === 'Activo').length,
        borradores: cursosGenerados.filter(c => c.estado === 'Borrador').length,
        inactivos: cursosGenerados.filter(c => c.estado === 'Inactivo').length
      },
      precio_promedio: parseFloat((cursosGenerados.reduce((sum, c) => sum + c.precio, 0) / cantidad).toFixed(2)),
      muestra_cursos: cursosGenerados.slice(0, 3), // Primeros 3 como muestra
      tenant_id
    };

    console.log(`✅ ${cantidad} cursos generados exitosamente para ${tenant_id}`);
    console.log('📊 Resumen:', resumen);

    return createResponse(200, { 
      mensaje: `🎉 Proceso completado exitosamente! Se generaron ${cantidad} cursos realistas con datos variados.`,
      resumen
    });

  } catch (error) {
    console.error('❌ Error al poblar cursos:', error.message);

    if (error.message.includes('Token')) {
      return createResponse(401, { mensaje: error.message });
    }
    
    return createResponse(500, { 
      mensaje: 'Error interno al intentar poblar la base de datos.',
      error_detalle: error.message 
    });
  }
};