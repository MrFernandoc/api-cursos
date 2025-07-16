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

    const curso = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: { tenant_id, curso_id }
    }).promise();

    if (!curso.Item) {
      return createResponse(404, { mensaje: 'Curso no encontrado' });
    }

    await dynamodb.delete({
      TableName: TABLE_NAME,
      Key: { tenant_id, curso_id }
    }).promise();

    return createResponse(200, { mensaje: 'Curso eliminado correctamente' });

  } catch (error) {
    console.error('Error al eliminar curso:', error.message);

    if (error.message.includes('Token')) {
      return createResponse(401, { mensaje: error.message });
    }
    
    return createResponse(500, { mensaje: 'Error interno al procesar la solicitud.' });
  }
};