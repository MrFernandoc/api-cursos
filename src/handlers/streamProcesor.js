const AWS = require('aws-sdk');
const axios = require('axios');

// IP de tu OpenSearch
const ELASTICSEARCH_ENDPOINT = process.env.ELASTICSEARCH_ENDPOINT || 'http://35.172.134.128:9200';

AWS.config.update({ region: 'us-east-1' });

module.exports.handler = async (event) => {
  console.log('🔥 Stream event recibido:', JSON.stringify(event, null, 2));

  try {
    // Procesar cada registro del stream
    for (const record of event.Records) {
      await procesarRegistroStream(record);
    }

    console.log('✅ Todos los registros procesados exitosamente');
    return { statusCode: 200, body: 'Procesamiento completado' };

  } catch (error) {
    console.error('❌ Error procesando stream:', error);
    throw error; // Esto hará que Lambda reintente el procesamiento
  }
};

async function procesarRegistroStream(record) {
  const { eventName, dynamodb } = record;
  console.log(`📝 Procesando evento: ${eventName}`);

  try {
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
    }
  } catch (error) {
    console.error(`❌ Error procesando registro ${eventName}:`, error);
    throw error;
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

async function indexarEnElasticsearch(tenantId, cursoId, documento, operacion = 'index') {
  const indice = `cursos_${tenantId}`.toLowerCase();
  const url = `${ELASTICSEARCH_ENDPOINT}/${indice}/_doc/${cursoId}`;
  
  console.log(`🔍 ${operacion.toUpperCase()} en OpenSearch:`, url);
  
  try {
    // Crear el índice si no existe
    await crearIndiceElasticsearchSiNoExiste(indice);
    
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
    
    console.log(`✅ Curso ${operacion}ado en OpenSearch:`, response.data);
    
  } catch (error) {
    console.error(`❌ Error al ${operacion} en OpenSearch:`, {
      url,
      error: error.response?.data || error.message,
      status: error.response?.status
    });
    throw error;
  }
}

async function eliminarDeElasticsearch(tenantId, cursoId) {
  const indice = `cursos_${tenantId}`.toLowerCase();
  const url = `${ELASTICSEARCH_ENDPOINT}/${indice}/_doc/${cursoId}`;
  
  console.log(`🗑️ ELIMINANDO de OpenSearch:`, url);
  
  try {
    const response = await axios.delete(url, {
      timeout: 10000
    });
    
    console.log(`✅ Curso eliminado de OpenSearch:`, response.data);
    
  } catch (error) {
    if (error.response?.status === 404) {
      console.log(`⚠️ Documento no encontrado en OpenSearch: ${cursoId}`);
      return; // No es un error crítico
    }
    
    console.error(`❌ Error al eliminar de OpenSearch:`, {
      url,
      error: error.response?.data || error.message,
      status: error.response?.status
    });
    throw error;
  }
}

async function crearIndiceElasticsearchSiNoExiste(indice) {
  const url = `${ELASTICSEARCH_ENDPOINT}/${indice}`;
  
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