const AWS = require('aws-sdk');
const { verificarToken } = require('../middlewares/authMiddleware');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME;

module.exports.handler = async (event) => {
  try {
    const payload = verificarToken(event);
    const tenant_id = payload.tenant_id;

    const curso_id = event.pathParameters?.curso_id;

    if (!curso_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'curso_id es requerido en la URL' }),
      };
    }

    const params = {
      TableName: TABLE_NAME,
      Key: {
        tenant_id,
        curso_id,
      },
      ConditionExpression: 'attribute_exists(tenant_id) AND attribute_exists(curso_id)',
    };

    await dynamodb.delete(params).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Curso eliminado correctamente' }),
    };
  } catch (err) {
    if (err.code === 'ConditionalCheckFailedException') {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'El curso no existe' }),
      };
    }

    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({
        message: err.message || 'Error al eliminar el curso',
      }),
    };
  }
};
