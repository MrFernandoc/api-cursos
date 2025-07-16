const AWS = require('aws-sdk');
const { validarTokenExternamente } = require('../middlewares/authMiddleware');
const { v4: uuidv4 } = require('uuid');
const { createResponse } = require('../utils/response');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME;

module.exports.handler = async (event) => {
  try {
    const token = event.headers.Authorization;
    const payload = await validarTokenExternamente(token);
    const tenant_id = payload.tenant_id;

    let body;
    try {
      body = JSON.parse(event.body);
    } catch (parseError) {
      return createResponse(400, { mensaje: 'El cuerpo de la petición contiene un JSON no válido.' });
    }

    if (!body.curso_datos || !body.curso_datos.nombre) {
      return createResponse(400, { mensaje: 'La propiedad "curso_datos" y su campo "nombre" son obligatorios.' });
    }

    const curso_id = uuidv4();
    const fecha_creacion = new Date().toISOString();

    const item = {
      tenant_id,
      curso_id,
      curso_datos: body.curso_datos,
      fecha_creacion
    };

    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: item
    }).promise();

    return createResponse(201, {
      mensaje: 'Curso creado exitosamente',
      curso_id
    });

  } catch (error) {
    console.error('Error al crear curso:', error.message);

    if (error.message.includes('Token')) {
      return createResponse(401, { mensaje: error.message });
    }
    
    return createResponse(500, { mensaje: 'Error interno al procesar la solicitud para crear el curso.' });
  }
};