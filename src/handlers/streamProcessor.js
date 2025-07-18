const AWS = require('aws-sdk');
const axios = require('axios');

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

module.exports.handler = async (event) => {
  console.log('🔥 Stream event recibido:', JSON.stringify(event, null, 2));

  const results = [];

  try {
    // Procesar cada registro del stream
    for (const record of event.Records) {
      const result = await procesarRegistroStream(record);
      results.push(result);
    }

    console.log('✅ Todos los registros procesados exitosamente:', results);
    return { statusCode: 200, body: 'Procesamiento completado', results };

  } catch (error) {
    console.error('❌ Error procesando stream:', error);
    throw error; // Esto hará que Lambda reintente el procesamiento
  }
};

async function procesarRegistroStream(record) {
  const { eventName, dynamodb } = record;
  console.log(`📝 Procesando evento: ${eventName}`);

  try {
    // Extraer tenant_id del registro para validación temprana
    const imageToCheck = dynamodb.NewImage || dynamodb.OldImage;
    const curso = convertirDynamoDBItemAObjeto(imageToCheck);
    const tenantId = curso.tenant_id;
    
    // ✅ Validar tenant ANTES de procesar
    if (!ALLOWED_TENANTS.includes(tenantId)) {
      console.warn(`⚠️ Tenant no configurado ignorado: ${tenantId} - Evento: ${eventName}`);
      // Return SUCCESS (no error) para que DynamoDB no reintente
      return { 
        status: 'ignored', 
        reason: 'tenant_not_configured', 
        tenant: tenantId,
        evento: eventName
      };
    }

    console.log(`✅ Procesando tenant autorizado: ${tenantId} - Evento: ${eventName}`);

    // Procesar normalmente para tenants configurados
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
        return { status: 'ignored', reason: 'event_not_handled', evento: eventName };
    }
    
    return { 
      status: 'processed', 
      tenant: tenantId, 
      evento: eventName 
    };
    
  } catch (error) {
    console.error(`❌ Error procesando registro ${eventName}:`, error);
    throw error; // Solo aquí sí queremos que reintente
  }
}

async function manejarInsercion(newImage) {
  console.log('➕ Manejando inserción de curso');
  
  const curso = convertirDynamoDBItemAObjeto(newImage);
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
  
  const cursoNuevo = convertirDynamoDBItemAObjeto(newImage);
  const documentoElasticsearch = prepararDocumentoParaElasticsearch(cursoNuevo);
  
  await indexarEnElasticsearch(
    cursoNuevo.tenant_id,
    cursoNuevo.curso_id,
    documentoElasticsearch,
    'index'  // 'index' actualiza o crea
  );
}

async function manejarEliminacion(oldImage) {
  console.log('🗑️ Manejando eliminación de curso');
  
  const curso = convertirDynamoDBItemAObjeto(oldImage);
  
  await eliminarDeElasticsearch(curso.tenant_id, curso.curso_id);
}

function convertirDynamoDBItemAObjeto(dynamoItem) {
  // Convertir formato DynamoDB a objeto normal
  const curso = {};
  
  for (const [key, value] of Object.entries(dynamoItem)) {
    if (value.S) curso[key] = value.S;
    else if (value.N) curso[key] = Number(value.N);
    else if (value.M) curso[key] = convertirDynamoDBItemAObjeto(value.M);
    else if (value.L) curso[key] = value.L.map(item => convertirDynamoDBItemAObjeto(item));
    else if (value.BOOL) curso[key] = value.BOOL;
  }
  
  return curso;
}

function prepararDocumentoParaElasticsearch(curso) {
  return {
    tenant_id: curso.tenant_id,
    curso_id: curso.curso_id,
    nombre: curso.curso_datos?.nombre || '',
    descripcion: curso.curso_datos?.descripcion || '',
    nivel: curso.curso_datos?.nivel || '',
    duracion_horas: curso.curso_datos?.duracion_horas || 0,
    precio: curso.curso_datos?.precio || 0,
    publicado: curso.curso_datos?.publicado || false,
    etiquetas: curso.curso_datos?.etiquetas || [],
    instructor: curso.curso_datos?.instructor || '',
    fecha_creacion: curso.fecha_creacion,
    fecha_modificacion: curso.curso_datos?.fecha_modificacion,
    // Campo combinado para búsqueda fulltext
    contenido_busqueda: [
      curso.curso_datos?.nombre,
      curso.curso_datos?.descripcion,
      curso.curso_datos?.nivel,
      curso.curso_datos?.instructor,
      ...(curso.curso_datos?.etiquetas || [])
    ].filter(Boolean).join(' ').toLowerCase()
  };
}

function obtenerElasticsearchURL(tenantId) {
  // Validación estricta de tenant
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
  const indice = `cursos_${tenantId.toLowerCase()}`;
  const url = `${elasticsearchURL}/${indice}/_doc/${cursoId}`;
  
  console.log(`🔍 ${operacion.toUpperCase()} en Elasticsearch:`, url);
  
  try {
    // Crear el índice si no existe
    await crearIndiceElasticsearchSiNoExiste(elasticsearchURL, indice);
    
    // Indexar el documento
    const response = await axios({
      method: operacion === 'create' ? 'POST' : 'PUT',
      url: url,
      data: documento,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log(`✅ Curso ${operacion}ado en Elasticsearch para ${tenantId}:`, response.data);
    
  } catch (error) {
    console.error(`❌ Error al ${operacion} en Elasticsearch:`, {
      url,
      tenantId,
      error: error.response?.data || error.message,
      status: error.response?.status
    });
    throw error;
  }
}

async function eliminarDeElasticsearch(tenantId, cursoId) {
  const elasticsearchURL = obtenerElasticsearchURL(tenantId);
  const indice = `cursos_${tenantId.toLowerCase()}`;
  const url = `${elasticsearchURL}/${indice}/_doc/${cursoId}`;
  
  console.log(`🗑️ ELIMINANDO de Elasticsearch:`, url);
  
  try {
    const response = await axios.delete(url, {
      timeout: 10000
    });
    
    console.log(`✅ Curso eliminado de Elasticsearch para ${tenantId}:`, response.data);
    
  } catch (error) {
    if (error.response?.status === 404) {
      console.log(`⚠️ Documento no encontrado en Elasticsearch: ${cursoId} (${tenantId})`);
      return; // No es un error crítico
    }
    
    console.error(`❌ Error al eliminar de Elasticsearch:`, {
      url,
      tenantId,
      error: error.response?.data || error.message,
      status: error.response?.status
    });
    throw error;
  }
}

async function crearIndiceElasticsearchSiNoExiste(elasticsearchURL, indice) {
  const url = `${elasticsearchURL}/${indice}`;
  
  try {
    // Verificar si el índice existe
    await axios.head(url, { timeout: 5000 });
    console.log(`📋 Índice ${indice} ya existe`);
    
  } catch (error) {
    if (error.response?.status === 404) {
      console.log(`📋 Creando índice ${indice}...`);
      
      // Configuración del índice con mappings optimizados para búsqueda
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
            descripcion: { 
              type: 'text', 
              analyzer: 'curso_analyzer' 
            },
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
            fecha_creacion: { type: 'date' },
            fecha_modificacion: { type: 'date' },
            contenido_busqueda: { 
              type: 'text', 
              analyzer: 'curso_analyzer' 
            }
          }
        }
      };
      
      await axios.put(url, configuracionIndice, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      
      console.log(`✅ Índice ${indice} creado exitosamente`);
    } else {
      throw error;
    }
  }
}