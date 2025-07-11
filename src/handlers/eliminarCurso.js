const AWS = require('aws-sdk');
const { validarTokenExternamente } = require('../middlewares/authMiddleware');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME;

module.exports.handler = async (event) => {
  try {
    const token = event.headers.Authorization;
    const payload = await validarTokenExternamente(token);
    const tenant_id = payload.tenant_id;

    const { curso_id } = event.pathParameters;

    // Verificar si el curso existe
    const curso = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: { tenant_id, curso_id }
    }).promise();

    if (!curso.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ mensaje: 'Curso no encontrado' })
      };
    }

    // Eliminar el curso
    await dynamodb.delete({
      TableName: TABLE_NAME,
      Key: { tenant_id, curso_id }
    }).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({ mensaje: 'Curso eliminado correctamente' })
    };

  } catch (error) {
    console.error('Error al eliminar curso:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ mensaje: error.message })
    };
  }
};
