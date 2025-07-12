const AWS = require('aws-sdk');
const { validarTokenExternamente } = require('../middlewares/authMiddleware');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME;

module.exports.handler = async (event) => {
  try {
    const token = event.headers.Authorization;
    const payload = await validarTokenExternamente(token);
    const tenant_id = payload.tenant_id;

    const body = JSON.parse(event.body);

    if (!body.curso_datos || !body.curso_datos.nombre) {
      return {
        statusCode: 400,
        body: JSON.stringify({ mensaje: 'El campo nombre es obligatorio' })
      };
    }

    const curso_id = uuidv4();

    const curso_datos = {
      nombre: body.curso_datos.nombre,
      ...body.curso_datos // incluye cualquier otro campo adicional
    };

    const item = {
      tenant_id,
      curso_id,
      curso_datos
    };

    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: item
    }).promise();

    return {
      statusCode: 201,
      body: JSON.stringify({
        mensaje: 'Curso creado exitosamente',
        curso_id
      })
    };

  } catch (error) {
    console.error('Error al crear curso:', error.message);
    return {
      statusCode: 401,
      body: JSON.stringify({ mensaje: error.message })
    };
  }
};
