const AWS = require('aws-sdk');
const { validarTokenExternamente } = require('../middlewares/authMiddleware');

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
      KeyConditionExpression: 'tenant_id = :tenant',
      ExpressionAttributeValues: {
        ':tenant': tenant_id
      },
      Limit: limit
    };

    if (lastKey) {
      params.ExclusiveStartKey = lastKey;
    }

    const resultado = await dynamodb.query(params).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({
        cursos: resultado.Items,
        lastEvaluatedKey: resultado.LastEvaluatedKey
          ? encodeURIComponent(JSON.stringify(resultado.LastEvaluatedKey))
          : null
      })
    };

  } catch (error) {
    console.error('Error al listar cursos:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ mensaje: error.message })
    };
  }
};
