const axios = require('axios');
const { validarTokenExternamente } = require('../middlewares/authMiddleware');
const { createResponse } = require('../utils/response');

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

module.exports.handler = async (event) => {
  try {
    const token = event.headers.Authorization;
    const payload = await validarTokenExternamente(token);
    const tenant_id = payload.tenant_id;

    // ✅ Validación estricta de tenant
    if (!ALLOWED_TENANTS.includes(tenant_id)) {
      console.error(`❌ Tenant no autorizado en búsqueda: ${tenant_id}`);
      return createResponse(403, { 
        mensaje: `Tenant "${tenant_id}" no está autorizado en el sistema de búsqueda`,
        codigo: 'TENANT_NOT_CONFIGURED',
        tenants_disponibles: ALLOWED_TENANTS
      });
    }

    console.log(`✅ Búsqueda autorizada para tenant: ${tenant_id}`);

    const queryParams = event.queryStringParameters || {};
    const query = queryParams.q || '';
    const limit = parseInt(queryParams.limit) || 10;
    const from = parseInt(queryParams.from) || 0;
    const tipo_busqueda = queryParams.tipo || 'fulltext';

    if (!query) {
      return createResponse(400, { mensaje: 'Parámetro de búsqueda "q" es requerido' });
    }

    // 🚀 OPTIMIZACIÓN: Para autocompletado, usar límites más pequeños y timeout reducido
    const esAutocompletado = tipo_busqueda === 'autocomplete';
    const limiteFinal = esAutocompletado ? Math.min(limit, 8) : limit; // Max 8 para autocompletado
    const timeoutMs = esAutocompletado ? 3000 : 10000; // 3s para autocompletado, 10s para otros

    const indice = `cursos_${tenant_id.toLowerCase()}`;
    const resultados = await buscarEnElasticsearch(tenant_id, indice, query, tipo_busqueda, from, limiteFinal, timeoutMs);

    return createResponse(200, {
      total: resultados.total,
      cursos: resultados.hits,
      desde: from,
      limite: limiteFinal,
      tipo_busqueda,
      tiempo_respuesta: resultados.took,
      tenant_usado: tenant_id,
      // 🆕 Info adicional para frontend
      es_autocompletado: esAutocompletado,
      query_length: query.length,
      suggestion_ready: query.length >= 2 // Frontend puede usar esto
    });

  } catch (error) {
    console.error('Error en búsqueda Elasticsearch:', error.message);
    
    if (error.message.includes('Token')) {
      return createResponse(401, { mensaje: error.message });
    }
    
    if (error.response?.status === 404) {
      return createResponse(200, { 
        total: 0, 
        cursos: [], 
        mensaje: 'No se encontraron cursos para este tenant' 
      });
    }
    
    return createResponse(500, { mensaje: 'Error interno en la búsqueda.' });
  }
};

// ✅ FUNCIÓN: Obtener URL de Elasticsearch específica por tenant con validación
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

// 🚀 FUNCIÓN MEJORADA: Con timeout configurable y enrutamiento por tenant
async function buscarEnElasticsearch(tenantId, indice, query, tipoBusqueda, from, size, timeoutMs = 10000) {
  const elasticsearchURL = obtenerElasticsearchURL(tenantId);
  const url = `${elasticsearchURL}/${indice}/_search`;
  
  let consultaElasticsearch;
  
  switch (tipoBusqueda) {
    case 'fuzzy':
      consultaElasticsearch = crearConsultaFuzzy(query);
      break;
    case 'prefix':
      consultaElasticsearch = crearConsultaPrefix(query);
      break;
    case 'autocomplete':
      consultaElasticsearch = crearConsultaAutocompleteMejorado(query); // 🆕 Versión optimizada
      break;
    case 'hibrida': // 🆕 NUEVA OPCIÓN
      consultaElasticsearch = crearConsultaHibrida(query);
      break;
    case 'fulltext':
    default:
      consultaElasticsearch = crearConsultaFulltext(query);
      break;
  }

  const payload = {
    from,
    size,
    query: consultaElasticsearch,
    highlight: {
      fields: {
        'nombre': {
          pre_tags: ['<mark>'],
          post_tags: ['</mark>'],
          fragment_size: 150
        },
        'descripcion': {
          pre_tags: ['<mark>'],
          post_tags: ['</mark>'],
          fragment_size: 200
        },
        'contenido_busqueda': {
          pre_tags: ['<mark>'],
          post_tags: ['</mark>'],
          fragment_size: 100
        }
      }
    },
    sort: [
      { '_score': { 'order': 'desc' } },
      { 'fecha_creacion': { 'order': 'desc' } }
    ],
    // 🚀 OPTIMIZACIÓN: Solo campos necesarios para autocompletado
    _source: tipoBusqueda === 'autocomplete' ? 
      ['curso_id', 'nombre', 'descripcion', 'nivel', 'precio', 'instructor', 'duracion_horas', 'etiquetas'] :
      true
  };

  console.log(`🔍 Consulta Elasticsearch para ${tenantId} (${tipoBusqueda}):`, JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: timeoutMs
    });

    const hits = response.data.hits.hits.map(hit => ({
      curso_id: hit._source.curso_id,
      nombre: hit._source.nombre,
      descripcion: hit._source.descripcion,
      nivel: hit._source.nivel,
      duracion_horas: hit._source.duracion_horas,
      precio: hit._source.precio,
      instructor: hit._source.instructor,
      etiquetas: hit._source.etiquetas,
      publicado: hit._source.publicado,
      fecha_creacion: hit._source.fecha_creacion,
      score: hit._score,
      highlight: hit.highlight,
      // 🆕 Para autocompletado, agregar snippet optimizado
      snippet: tipoBusqueda === 'autocomplete' ? 
        crearSnippetAutocompletado(hit._source, query) : null
    }));

    return {
      total: response.data.hits.total.value || response.data.hits.total,
      took: response.data.took,
      hits
    };

  } catch (error) {
    console.error('Error consultando Elasticsearch:', {
      url,
      tenantId,
      error: error.response?.data || error.message,
      status: error.response?.status,
      timeout: timeoutMs
    });
    throw error;
  }
}

// 🆕 AUTOCOMPLETADO MEJORADO: Más rápido y relevante
function crearConsultaAutocompleteMejorado(query) {
  return {
    bool: {
      should: [
        // 1. Match exacto en nombre (máxima prioridad)
        {
          match_phrase_prefix: {
            nombre: {
              query: query,
              boost: 10.0,
              max_expansions: 5 // Reducido para velocidad
            }
          }
        },
        // 2. Prefijo en nombre.keyword
        {
          prefix: {
            'nombre.keyword': {
              value: query,
              boost: 8.0
            }
          }
        },
        // 3. Match en etiquetas
        {
          prefix: {
            etiquetas: {
              value: query.toLowerCase(),
              boost: 6.0
            }
          }
        },
        // 4. Match en instructor
        {
          match_phrase_prefix: {
            instructor: {
              query: query,
              boost: 4.0,
              max_expansions: 3
            }
          }
        },
        // 5. Fallback general
        {
          match_phrase_prefix: {
            contenido_busqueda: {
              query: query,
              boost: 2.0,
              max_expansions: 8
            }
          }
        }
      ],
      filter: [
        { term: { publicado: true } }
      ],
      minimum_should_match: 1
    }
  };
}

// 🆕 BÚSQUEDA HÍBRIDA: Combina múltiples algoritmos
function crearConsultaHibrida(query) {
  return {
    bool: {
      should: [
        // Exacto
        {
          match_phrase: {
            nombre: {
              query: query,
              boost: 15.0
            }
          }
        },
        // Fulltext
        {
          multi_match: {
            query: query,
            fields: ['nombre^5', 'descripcion^3', 'instructor^2', 'contenido_busqueda'],
            type: 'best_fields',
            fuzziness: 'AUTO',
            boost: 8.0
          }
        },
        // Prefijo
        {
          prefix: {
            'nombre.keyword': {
              value: query,
              boost: 6.0
            }
          }
        },
        // Fuzzy
        {
          fuzzy: {
            nombre: {
              value: query,
              fuzziness: 1,
              boost: 4.0
            }
          }
        },
        // Autocompletado
        {
          match_phrase_prefix: {
            nombre: {
              query: query,
              max_expansions: 10,
              boost: 5.0
            }
          }
        }
      ],
      filter: [
        { term: { publicado: true } }
      ],
      minimum_should_match: 1
    }
  };
}

// 🆕 FUNCIÓN: Crear snippet para autocompletado
function crearSnippetAutocompletado(source, query) {
  const queryLower = query.toLowerCase();
  
  // Priorizar nombre si contiene la query
  if (source.nombre.toLowerCase().includes(queryLower)) {
    return `${source.nombre} - ${source.instructor}`;
  }
  
  // Luego descripción
  if (source.descripcion.toLowerCase().includes(queryLower)) {
    const index = source.descripcion.toLowerCase().indexOf(queryLower);
    const start = Math.max(0, index - 20);
    const snippet = source.descripcion.substring(start, start + 60);
    return `${source.nombre} - ...${snippet}...`;
  }
  
  // Default
  return `${source.nombre} - ${source.nivel} - ${source.instructor}`;
}

// FUNCIONES ORIGINALES (sin cambios)
function crearConsultaFulltext(query) {
  return {
    bool: {
      should: [
        {
          multi_match: {
            query: query,
            fields: ['nombre^3', 'descripcion^2', 'instructor^2', 'contenido_busqueda'],
            type: 'best_fields',
            fuzziness: 'AUTO'
          }
        },
        {
          wildcard: {
            'contenido_busqueda': `*${query.toLowerCase()}*`
          }
        }
      ],
      filter: [
        { term: { publicado: true } }
      ]
    }
  };
}

function crearConsultaFuzzy(query) {
  return {
    bool: {
      should: [
        {
          fuzzy: {
            nombre: {
              value: query,
              fuzziness: 2
            }
          }
        },
        {
          fuzzy: {
            descripcion: {
              value: query,
              fuzziness: 2
            }
          }
        },
        {
          fuzzy: {
            contenido_busqueda: {
              value: query,
              fuzziness: 2
            }
          }
        }
      ],
      filter: [
        { term: { publicado: true } }
      ]
    }
  };
}

function crearConsultaPrefix(query) {
  return {
    bool: {
      should: [
        {
          prefix: {
            'nombre.keyword': query
          }
        },
        {
          prefix: {
            contenido_busqueda: query.toLowerCase()
          }
        }
      ],
      filter: [
        { term: { publicado: true } }
      ]
    }
  };
}

// 🔄 FUNCIÓN ORIGINAL DE AUTOCOMPLETADO (mantenida para compatibilidad)
function crearConsultaAutocomplete(query) {
  return {
    bool: {
      should: [
        {
          match_phrase_prefix: {
            nombre: {
              query: query,
              max_expansions: 10
            }
          }
        },
        {
          match_phrase_prefix: {
            contenido_busqueda: {
              query: query,
              max_expansions: 10
            }
          }
        }
      ],
      filter: [
        { term: { publicado: true } }
      ]
    }
  };
}