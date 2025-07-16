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

    const queryParams = event.queryStringParameters || {};
    const limit = parseInt(queryParams.limit) || 10;
    const lastKey = queryParams.lastKey ? JSON.parse(decodeURIComponent(queryParams.lastKey)) : null;

    const params = {
      TableName: TABLE_NAME,
      IndexName: 'CursosPorFechaIndex',
      KeyConditionExpression: 'tenant_id = :tenant',
      ExpressionAttributeValues: {
        ':tenant': tenant_id
      },
      Limit: limit,
      ScanIndexForward: false
    };

    if (lastKey) {
      params.ExclusiveStartKey = lastKey;
    }

    const resultado = await dynamodb.query(params).promise();

    return createResponse(200, {
      cursos: resultado.Items,
      lastEvaluatedKey: resultado.LastEvaluatedKey
        ? encodeURIComponent(JSON.stringify(resultado.LastEvaluatedKey))
        : null
    });

  } catch (error) {
    console.error('Error al listar cursos:', error.message);
    
    if (error.message.includes('Token')) {
      return createResponse(401, { mensaje: error.message });
    }

    return createResponse(500, { mensaje: 'Error interno al procesar la solicitud.' });
  }
};