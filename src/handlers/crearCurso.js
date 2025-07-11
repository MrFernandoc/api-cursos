const AWS = require('aws-sdk');
const { verificarToken } = require('../middlewares/authMiddleware');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME;

module.exports.handler = async (event) => {
  try {
    const payload = verificarToken(event);
    const tenant_id = payload.tenant_id;

    const body = JSON.parse(event.body);
    const { curso_id, curso_datos } = body;

    if (!curso_id || !curso_datos || typeof curso_datos !== 'object') {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'curso_id y curso_datos son requeridos',
        }),
      };
    }

    const params = {
      TableName: TABLE_NAME,
      Item: {
        tenant_id,
        curso_id,
        curso_datos,
      },
      ConditionExpression: 'attribute_not_exists(tenant_id) AND attribute_not_exists(curso_id)',
    };

    await dynamodb.put(params).promise();

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: 'Curso creado correctamente',
        curso: {
          tenant_id,
          curso_id,
          curso_datos,
        },
      }),
    };
  } catch (err) {
    if (err.code === 'ConditionalCheckFailedException') {
      return {
        statusCode: 409,
        body: JSON.stringify({ message: 'El curso ya existe' }),
      };
    }

    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({
        message: err.message || 'Error al crear el curso',
      }),
    };
  }
};
