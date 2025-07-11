const AWS = require('aws-sdk');
const { verificarToken } = require('../middlewares/authMiddleware');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME;

module.exports.handler = async (event) => {
  try {
    const payload = verificarToken(event);
    const tenant_id = payload.tenant_id;

    const curso_id = event.pathParameters?.curso_id;
    const body = JSON.parse(event.body);
    const curso_datos = body.curso_datos;

    if (!curso_id || !curso_datos || typeof curso_datos !== 'object') {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'curso_id y curso_datos son requeridos' }),
      };
    }

    const params = {
      TableName: TABLE_NAME,
      Key: {
        tenant_id,
        curso_id,
      },
      UpdateExpression: 'set curso_datos = :datos',
      ExpressionAttributeValues: {
        ':datos': curso_datos,
      },
      ConditionExpression: 'attribute_exists(tenant_id) AND attribute_exists(curso_id)',
      ReturnValues: 'ALL_NEW',
    };

    const result = await dynamodb.update(params).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Curso modificado correctamente',
        curso: result.Attributes,
      }),
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
      body: JSON.stringify({ message: err.message || 'Error al modificar el curso' }),
    };
  }
};
