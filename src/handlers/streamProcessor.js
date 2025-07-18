const AWS = require('aws-sdk');
const axios = require('axios');
const { unmarshall } = require('@aws-sdk/util-dynamodb');

// Configuración de Elasticsearch
const validateElasticsearchConfig = () => {
  const baseURL = process.env.ELASTICSEARCH_ENDPOINT;
  
  if (!baseURL) {
    console.error('❌ ELASTICSEARCH_ENDPOINT not configured');
    throw new Error('Missing required environment variable: ELASTICSEARCH_ENDPOINT');
  }
  
  console.log('✅ Elasticsearch configured:', baseURL);
  return baseURL;
};

const ELASTICSEARCH_BASE_URL = validateElasticsearchConfig();

// Mapeo de tenant_id reales a puertos específicos
const TENANT_PORTS = {
  'UTEC': '9201',
  'MIT': '9202'
};

// Lista de tenants permitidos
const ALLOWED_TENANTS = ['UTEC', 'MIT'];

AWS.config.update({ region: 'us-east-1' });

// 🔧 FUNCIÓN NUEVA: Extraer stage real desde el evento DynamoDB
function extractStageFromEvent(record) {
  // El stage está en el nombre de la tabla DynamoDB
  // Ejemplo: "dev-t_cursos" -> "dev", "test-t_cursos" -> "test"
  
  // Opción 1: Desde eventSourceARN
  if (record.eventSourceARN) {
    const arnParts = record.eventSourceARN.split('/');
    const tableName = arnParts[1]; // Formato: arn:aws:dynamodb:region:account:table/TABLE_NAME/stream/...
    
    if (tableName && tableName.includes('-t_cursos')) {
      const stage = tableName.split('-t_cursos')[0];
      console.log(`🎯 Stage extraído del ARN: ${stage}`);
      return stage;
    }
  }
  
  // Opción 2: Desde el nombre de la función Lambda (fallback)
  const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME || '';
  if (functionName.includes('-dev-')) return 'dev';
  if (functionName.includes('-test-')) return 'test';
  if (functionName.includes('-prod-')) return 'prod';
  
  // Opción 3: Desde variable de entorno (fallback)
  const envStage = process.env.STAGE || process.env.AWS_STAGE;
  if (envStage) {
    console.log(`🎯 Stage desde variable de entorno: ${envStage}`);
    return envStage;
  }
  
  // Fallback final
  console.warn('⚠️ No se pudo determinar el stage, usando "dev" por defecto');
  return 'dev';
}

module.exports.handler = async (event) => {
  console.log('🔥 Stream event recibido:', JSON.stringify(event, null, 2));
  
  // 🔧 CORRECCIÓN: Extraer stage del primer record (todos deberían ser del mismo stage)
  const currentStage = event.Records.length > 0 ? extractStageFromEvent(event.Records[0]) : 'dev';
  
  console.log(`🎯 Procesando en stage: ${currentStage}`);

  const results = [];

  try {
    // Procesar en paralelo para mejor performance
    const processingPromises = event.Records.map(record => procesarRegistroStream(record, currentStage));
    const recordResults = await Promise.allSettled(processingPromises);
    
    recordResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error(`❌ Error procesando record ${index}:`, result.reason);
        results.push({ status: 'error', reason: result.reason.message, index });
      }
    });

    console.log('✅ Todos los registros procesados:', results);
    return { statusCode: 200, body: 'Procesamiento completado', results };

  } catch (error) {
    console.error('❌ Error procesando stream:', error);
    throw error;
  }
};

async function procesarRegistroStream(record, currentStage) {
  const { eventName, dynamodb } = record;
  console.log(`📝 Procesando evento: ${eventName} en stage: ${currentStage}`);

  try {
    // Conversión ultrarrápida con AWS SDK
    const imageToCheck = dynamodb.NewImage || dynamodb.OldImage;
    const curso = unmarshall(imageToCheck);
    const tenantId = curso.tenant_id;
    
    // ✅ Validar tenant ANTES de procesar
    if (!ALLOWED_TENANTS.includes(tenantId)) {
      console.warn(`⚠️ Tenant no configurado ignorado: ${tenantId} - Evento: ${eventName}`);
      return { 
        status: 'ignored', 
        reason: 'tenant_not_configured', 
        tenant: tenantId,
        evento: eventName,
        stage: currentStage
      };
    }

    console.log(`✅ Procesando tenant autorizado: ${tenantId} - Evento: ${eventName} - Stage: ${currentStage}`);

    // 🔧 CORRECCIÓN: Pasar el stage real a cada función
    switch (eventName) {
      case 'INSERT':
        await manejarInsercion(dynamodb.NewImage, currentStage);
        break;
      case 'MODIFY':
        await manejarModificacion(dynamodb.NewImage, dynamodb.OldImage, currentStage);
        break;
      case 'REMOVE':
        await manejarEliminacion(dynamodb.OldImage, currentStage);
        break;
      default:
        console.log(`⚠️ Evento no manejado: ${eventName}`);
        return { status: 'ignored', reason: 'event_not_handled', evento: eventName, stage: currentStage };
    }
    
    return { 
      status: 'processed', 
      tenant: tenantId, 
      evento: eventName,
      stage: currentStage
    };
    
  } catch (error) {
    console.error(`❌ Error procesando registro ${eventName}:`, error);
    throw error;
  }
}

async function manejarInsercion(newImage, currentStage) {
  console.log(`➕ Manejando inserción de curso en stage: ${currentStage}`);
  
  const curso = unmarshall(newImage);
  const documentoElasticsearch = prepararDocumentoParaElasticsearch(curso, currentStage);
  
  await indexarEnElasticsearch(
    curso.tenant_id,
    curso.curso_id,
    documentoElasticsearch,
    'create',
    currentStage
  );
}

async function manejarModificacion(newImage, oldImage, currentStage) {
  console.log(`✏️ Manejando modificación de curso en stage: ${currentStage}`);
  
  const cursoNuevo = unmarshall(newImage);
  const documentoElasticsearch = prepararDocumentoParaElasticsearch(cursoNuevo, currentStage);
  
  await indexarEnElasticsearch(
    cursoNuevo.tenant_id,
    cursoNuevo.curso_id,
    documentoElasticsearch,
    'index',
    currentStage
  );
}

async function manejarEliminacion(oldImage, currentStage) {
  console.log(`🗑️ Manejando eliminación de curso en stage: ${currentStage}`);
  
  const curso = unmarshall(oldImage);
  
  await eliminarDeElasticsearch(curso.tenant_id, curso.curso_id, currentStage);
}

// 🔧 FUNCIÓN MODIFICADA: Ahora recibe el stage como parámetro
function prepararDocumentoParaElasticsearch(curso, currentStage) {
  const {
    tenant_id = '',
    curso_id = '',
    fecha_creacion = new Date().toISOString(),
    curso_datos = {}
  } = curso;

  const {
    nombre = '',
    descripcion = '',
    nivel = '',
    duracion_horas = 0,
    precio = 0,
    publicado = false,
    etiquetas = [],
    instructor = '',
    categoria = 'General',
    estado = 'Activo',
    fecha_modificacion = null
  } = curso_datos;

  // Validación rápida de etiquetas
  const etiquetasLimpias = Array.isArray(etiquetas) 
    ? etiquetas.filter(tag => typeof tag === 'string' && tag.trim())
    : [];

  const documento = {
    tenant_id,
    curso_id,
    nombre,
    descripcion,
    nivel,
    duracion_horas: Number(duracion_horas) || 0,
    precio: Number(precio) || 0,
    publicado: Boolean(publicado),
    etiquetas: etiquetasLimpias,
    instructor,
    categoria,
    estado,
    fecha_creacion,
    fecha_modificacion,
    stage: currentStage, // 🔧 USAR EL STAGE REAL
    contenido_busqueda: [nombre, descripcion, nivel, instructor, categoria, estado, ...etiquetasLimpias]
      .join(' ').toLowerCase()
  };

  console.log(`📄 Documento preparado para Elasticsearch (${currentStage}):`, JSON.stringify(documento, null, 2));
  return documento;
}

function obtenerElasticsearchURL(tenantId) {
  if (!ALLOWED_TENANTS.includes(tenantId)) {
    console.error(`❌ Tenant no autorizado: ${tenantId}`);
    throw new Error(`Tenant "${tenantId}" no está autorizado en el sistema`);
  }
  
  const puerto = TENANT_PORTS[tenantId];
  const baseURL = `${ELASTICSEARCH_BASE_URL}:${puerto}`;
  
  console.log(`✅ URL Elasticsearch para ${tenantId}: ${baseURL}`);
  return baseURL;
}

// 🔧 FUNCIÓN MODIFICADA: Ahora recibe el stage como parámetro
async function indexarEnElasticsearch(tenantId, cursoId, documento, operacion = 'index', currentStage) {
  const elasticsearchURL = obtenerElasticsearchURL(tenantId);
  const indice = `cursos_${tenantId.toLowerCase()}_${currentStage}`; // 🔧 USAR STAGE REAL
  const url = `${elasticsearchURL}/${indice}/_doc/${cursoId}`;
  
  console.log(`🔍 ${operacion.toUpperCase()} en Elasticsearch:`, url);
  console.log(`📋 Índice con stage correcto: ${indice}`);
  
  try {
    await crearIndiceElasticsearchSiNoExiste(elasticsearchURL, indice);
    
    const response = await axios({
      method: operacion === 'create' ? 'POST' : 'PUT',
      url: url,
      data: documento,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log(`✅ Curso ${operacion}ado en Elasticsearch para ${tenantId} (${currentStage}):`, response.data);
    
  } catch (error) {
    console.error(`❌ Error al ${operacion} en Elasticsearch:`, {
      url,
      tenantId,
      stage: currentStage,
      indice,
      error: error.response?.data || error.message,
      status: error.response?.status
    });
    throw error;
  }
}

// 🔧 FUNCIÓN MODIFICADA: Ahora recibe el stage como parámetro
async function eliminarDeElasticsearch(tenantId, cursoId, currentStage) {
  const elasticsearchURL = obtenerElasticsearchURL(tenantId);
  const indice = `cursos_${tenantId.toLowerCase()}_${currentStage}`; // 🔧 USAR STAGE REAL
  const url = `${elasticsearchURL}/${indice}/_doc/${cursoId}`;
  
  console.log(`🗑️ ELIMINANDO de Elasticsearch:`, url);
  console.log(`📋 Índice con stage correcto: ${indice}`);
  
  try {
    const response = await axios.delete(url, {
      timeout: 10000
    });
    
    console.log(`✅ Curso eliminado de Elasticsearch para ${tenantId} (${currentStage}):`, response.data);
    
  } catch (error) {
    if (error.response?.status === 404) {
      console.log(`⚠️ Documento no encontrado en Elasticsearch: ${cursoId} (${tenantId}, ${currentStage})`);
      return;
    }
    
    console.error(`❌ Error al eliminar de Elasticsearch:`, {
      url,
      tenantId,
      stage: currentStage,
      indice,
      error: error.response?.data || error.message,
      status: error.response?.status
    });
    throw error;
  }
}

// Cache de índices existentes para evitar verificaciones repetidas
const indicesExistentes = new Set();

async function crearIndiceElasticsearchSiNoExiste(elasticsearchURL, indice) {
  if (indicesExistentes.has(indice)) {
    console.log(`📋 Índice ${indice} ya verificado en cache`);
    return;
  }

  const url = `${elasticsearchURL}/${indice}`;
  
  try {
    await axios.head(url, { timeout: 5000 });
    console.log(`📋 Índice ${indice} ya existe`);
    indicesExistentes.add(indice);
    
  } catch (error) {
    if (error.response?.status === 404) {
      console.log(`📋 Creando índice ${indice}...`);
      
      const configuracionIndice = {
        settings: {
          analysis: {
            analyzer: {
              curso_analyzer: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['lowercase', 'asciifolding', 'stop']
              }
            }
          }
        },
        mappings: {
          properties: {
            tenant_id: { type: 'keyword' },
            curso_id: { type: 'keyword' },
            nombre: { 
              type: 'text', 
              analyzer: 'curso_analyzer',
              fields: {
                keyword: { type: 'keyword' },
                suggest: { type: 'completion' }
              }
            },
            descripcion: { type: 'text', analyzer: 'curso_analyzer' },
            nivel: { type: 'keyword' },
            duracion_horas: { type: 'integer' },
            precio: { type: 'float' },
            publicado: { type: 'boolean' },
            etiquetas: { type: 'keyword' },
            instructor: { 
              type: 'text', 
              analyzer: 'curso_analyzer',
              fields: { keyword: { type: 'keyword' } }
            },
            categoria: { type: 'keyword' },
            estado: { type: 'keyword' },
            stage: { type: 'keyword' },
            fecha_creacion: { type: 'date' },
            fecha_modificacion: { type: 'date' },
            contenido_busqueda: { type: 'text', analyzer: 'curso_analyzer' }
          }
        }
      };
      
      await axios.put(url, configuracionIndice, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      
      console.log(`✅ Índice ${indice} creado exitosamente`);
      indicesExistentes.add(indice);
    } else {
      throw error;
    }
  }
}