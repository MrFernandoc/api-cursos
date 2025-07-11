const AWS = require('aws-sdk');
const { verificarToken } = require('../middlewares/authMiddleware');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME;

module.exports.handler = async (event) => {
  try {
    const payload = verificarToken(event);
    const tenant_id = payload.tenant_id;

    const queryParams = event.queryStringParameters || {};
    const limit = parseInt(queryParams.limit) || 10;

    let params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'tenant_id = :tid',
      ExpressionAttributeValues: {
        ':tid': tenant_id,
      },
      Limit: limit,
    };

    if (queryParams.lastKey) {
      // Suponemos que el lastKey es el curso_id del último curso
      params.ExclusiveStartKey = {
        tenant_id,
        curso_id: queryParams.lastKey,
      };
    }

    const data = await dynamodb.query(params).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Cursos encontrados',
        cursos: data.Items,
        nextPageToken: data.LastEvaluatedKey ? data.LastEvaluatedKey.curso_id : null,
      }),
    };
  } catch (err) {
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({
        message: err.message || 'Error al listar cursos',
      }),
    };
  }
};
