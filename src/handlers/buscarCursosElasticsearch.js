const axios = require('axios');
const { validarTokenExternamente } = require('../middlewares/authMiddleware');
const { createResponse } = require('../utils/response');

const ELASTICSEARCH_ENDPOINT = process.env.ELASTICSEARCH_ENDPOINT || 'http://35.172.134.128:9200';

module.exports.handler = async (event) => {
  try {
    const token = event.headers.Authorization;
    const payload = await validarTokenExternamente(token);
    const tenant_id = payload.tenant_id;

    const queryParams = event.queryStringParameters || {};
    const query = queryParams.q || '';
    const limit = parseInt(queryParams.limit) || 10;
    const from = parseInt(queryParams.from) || 0;
    const tipo_busqueda = queryParams.tipo || 'fulltext'; // fulltext, fuzzy, prefix, autocomplete

    if (!query) {
      return createResponse(400, { mensaje: 'Parámetro de búsqueda "q" es requerido' });
    }

    const indice = `cursos_${tenant_id}`.toLowerCase();
    const resultados = await buscarEnElasticsearch(indice, query, tipo_busqueda, from, limit);

    return createResponse(200, {
      total: resultados.total,
      cursos: resultados.hits,
      desde: from,
      limite: limit,
      tipo_busqueda,
      tiempo_respuesta: resultados.took
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

async function buscarEnElasticsearch(indice, query, tipoBusqueda, from, size) {
  const url = `${ELASTICSEARCH_ENDPOINT}/${indice}/_search`;
  
  let consultaElasticsearch;
  
  switch (tipoBusqueda) {
    case 'fuzzy':
      consultaElasticsearch = crearConsultaFuzzy(query);
      break;
    case 'prefix':
      consultaElasticsearch = crearConsultaPrefix(query);
      break;
    case 'autocomplete':
      consultaElasticsearch = crearConsultaAutocomplete(query);
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
        'nombre': {},
        'descripcion': {},
        'contenido_busqueda': {}
      }
    },
    sort: [
      { '_score': { 'order': 'desc' } },
      { 'fecha_creacion': { 'order': 'desc' } }
    ]
  };

  console.log('🔍 Consulta OpenSearch:', JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    return {
      total: response.data.hits.total.value || response.data.hits.total,
      took: response.data.took,
      hits: response.data.hits.hits.map(hit => ({
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
        highlight: hit.highlight
      }))
    };

  } catch (error) {
    console.error('Error consultando OpenSearch:', {
      url,
      error: error.response?.data || error.message,
      status: error.response?.status
    });
    throw error;
  }
}

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