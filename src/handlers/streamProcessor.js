const AWS = require('aws-sdk');
const axios = require('axios');
// 🚀 OPTIMIZACIÓN: Usar AWS SDK Utilities para conversión ultrarrápida
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

// Obtener stage actual (dev, test, prod)
const CURRENT_STAGE = process.env.STAGE || process.env.AWS_STAGE || 'dev';

AWS.config.update({ region: 'us-east-1' });

module.exports.handler = async (event) => {
  console.log('🔥 Stream event recibido:', JSON.stringify(event, null, 2));
  console.log(`🎯 Procesando en stage: ${CURRENT_STAGE}`);

  const results = [];

  try {
    // 🚀 OPTIMIZACIÓN: Procesar en paralelo para mejor performance
    const processingPromises = event.Records.map(record => procesarRegistroStream(record));
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

async function procesarRegistroStream(record) {
  const { eventName, dynamodb } = record;
  console.log(`📝 Procesando evento: ${eventName}`);

  try {
    // 🚀 OPTIMIZACIÓN: Conversión ultrarrápida con AWS SDK
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
        stage: CURRENT_STAGE
      };
    }

    console.log(`✅ Procesando tenant autorizado: ${tenantId} - Evento: ${eventName} - Stage: ${CURRENT_STAGE}`);

    // 🚀 OPTIMIZACIÓN: Switch optimizado con async/await directo
    switch (eventName) {
      case 'INSERT':
        await manejarInsercion(dynamodb.NewImage);
        break;
      case 'MODIFY':
        await manejarModificacion(dynamodb.NewImage, dynamodb.OldImage);
        break;
      case 'REMOVE':
        await manejarEliminacion(dynamodb.OldImage);
        break;
      default:
        console.log(`⚠️ Evento no manejado: ${eventName}`);
        return { status: 'ignored', reason: 'event_not_handled', evento: eventName, stage: CURRENT_STAGE };
    }
    
    return { 
      status: 'processed', 
      tenant: tenantId, 
      evento: eventName,
      stage: CURRENT_STAGE
    };
    
  } catch (error) {
    console.error(`❌ Error procesando registro ${eventName}:`, error);
    throw error;
  }
}

async function manejarInsercion(newImage) {
  console.log('➕ Manejando inserción de curso');
  
  // 🚀 OPTIMIZACIÓN: Conversión directa con unmarshall
  const curso = unmarshall(newImage);
  const documentoElasticsearch = prepararDocumentoParaElasticsearch(curso);
  
  await indexarEnElasticsearch(
    curso.tenant_id,
    curso.curso_id,
    documentoElasticsearch,
    'create'
  );
}

async function manejarModificacion(newImage, oldImage) {
  console.log('✏️ Manejando modificación de curso');
  
  // 🚀 OPTIMIZACIÓN: Conversión directa con unmarshall
  const cursoNuevo = unmarshall(newImage);
  const documentoElasticsearch = prepararDocumentoParaElasticsearch(cursoNuevo);
  
  await indexarEnElasticsearch(
    cursoNuevo.tenant_id,
    cursoNuevo.curso_id,
    documentoElasticsearch,
    'index'
  );
}

async function manejarEliminacion(oldImage) {
  console.log('🗑️ Manejando eliminación de curso');
  
  // 🚀 OPTIMIZACIÓN: Conversión directa con unmarshall
  const curso = unmarshall(oldImage);
  
  await eliminarDeElasticsearch(curso.tenant_id, curso.curso_id);
}

// 🚀 FUNCIÓN OPTIMIZADA: Preparación ultrarrápida de documentos
function prepararDocumentoParaElasticsearch(curso) {
  // 🚀 OPTIMIZACIÓN: Desestructuración directa y valores por defecto
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

  // 🚀 OPTIMIZACIÓN: Validación rápida de etiquetas
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
    stage: CURRENT_STAGE,
    // 🚀 OPTIMIZACIÓN: Join directo sin filtros innecesarios
    contenido_busqueda: [nombre, descripcion, nivel, instructor, categoria, estado, ...etiquetasLimpias]
      .join(' ').toLowerCase()
  };

  console.log('📄 Documento preparado para Elasticsearch:', JSON.stringify(documento, null, 2));
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

async function indexarEnElasticsearch(tenantId, cursoId, documento, operacion = 'index') {
  const elasticsearchURL = obtenerElasticsearchURL(tenantId);
  const indice = `cursos_${tenantId.toLowerCase()}_${CURRENT_STAGE}`;
  const url = `${elasticsearchURL}/${indice}/_doc/${cursoId}`;
  
  console.log(`🔍 ${operacion.toUpperCase()} en Elasticsearch:`, url);
  console.log(`📋 Índice con stage: ${indice}`);
  
  try {
    // 🚀 OPTIMIZACIÓN: Crear índice y documento en paralelo cuando es posible
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
    
    console.log(`✅ Curso ${operacion}ado en Elasticsearch para ${tenantId} (${CURRENT_STAGE}):`, response.data);
    
  } catch (error) {
    console.error(`❌ Error al ${operacion} en Elasticsearch:`, {
      url,
      tenantId,
      stage: CURRENT_STAGE,
      indice,
      error: error.response?.data || error.message,
      status: error.response?.status
    });
    throw error;
  }
}

async function eliminarDeElasticsearch(tenantId, cursoId) {
  const elasticsearchURL = obtenerElasticsearchURL(tenantId);
  const indice = `cursos_${tenantId.toLowerCase()}_${CURRENT_STAGE}`;
  const url = `${elasticsearchURL}/${indice}/_doc/${cursoId}`;
  
  console.log(`🗑️ ELIMINANDO de Elasticsearch:`, url);
  console.log(`📋 Índice con stage: ${indice}`);
  
  try {
    const response = await axios.delete(url, {
      timeout: 10000
    });
    
    console.log(`✅ Curso eliminado de Elasticsearch para ${tenantId} (${CURRENT_STAGE}):`, response.data);
    
  } catch (error) {
    if (error.response?.status === 404) {
      console.log(`⚠️ Documento no encontrado en Elasticsearch: ${cursoId} (${tenantId}, ${CURRENT_STAGE})`);
      return;
    }
    
    console.error(`❌ Error al eliminar de Elasticsearch:`, {
      url,
      tenantId,
      stage: CURRENT_STAGE,
      indice,
      error: error.response?.data || error.message,
      status: error.response?.status
    });
    throw error;
  }
}

// 🚀 OPTIMIZACIÓN: Cache de índices existentes para evitar verificaciones repetidas
const indicesExistentes = new Set();

async function crearIndiceElasticsearchSiNoExiste(elasticsearchURL, indice) {
  // 🚀 OPTIMIZACIÓN: Cache en memoria para evitar llamadas repetidas
  if (indicesExistentes.has(indice)) {
    console.log(`📋 Índice ${indice} ya verificado en cache`);
    return;
  }

  const url = `${elasticsearchURL}/${indice}`;
  
  try {
    await axios.head(url, { timeout: 5000 });
    console.log(`📋 Índice ${indice} ya existe`);
    indicesExistentes.add(indice); // 🚀 Agregar a cache
    
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
      indicesExistentes.add(indice); // 🚀 Agregar a cache
    } else {
      throw error;
    }
  }
}