const AWS = require('aws-sdk');
const { validarTokenExternamente } = require('../middlewares/authMiddleware');
const { createResponse } = require('../utils/response');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME;

module.exports.handler = async (event) => {
  try {
    const token = event.headers.Authorization;
    const payload = await validarTokenExternamente(token);
    const tenant_id = payload.tenant_id;

    const { curso_id } = event.pathParameters;
    
    let nuevos_datos;
    try {
      nuevos_datos = JSON.parse(event.body);
    } catch (parseError) {
      return createResponse(400, { mensaje: 'El cuerpo de la petición contiene un JSON no válido.' });
    }

    const resultado = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: { tenant_id, curso_id }
    }).promise();

    if (!resultado.Item) {
      return createResponse(404, { mensaje: 'Curso no encontrado' });
    }

    const cursoExistente = resultado.Item;

    const curso_datos_actualizados = {
      ...cursoExistente.curso_datos,
      ...nuevos_datos,
      fecha_modificacion: new Date().toISOString() 
    };

    const item_actualizado = {
      tenant_id,
      curso_id,
      curso_datos: curso_datos_actualizados,
      fecha_creacion: cursoExistente.fecha_creacion
    };

    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: item_actualizado
    }).promise();

    return createResponse(200, { mensaje: 'Curso modificado exitosamente' });

  } catch (error) {
    console.error('Error al modificar curso:', error.message);

    if (error.message.includes('Token')) {
      return createResponse(401, { mensaje: error.message });
    }
    
    return createResponse(500, { mensaje: 'Error interno al procesar la solicitud.' });
  }
};