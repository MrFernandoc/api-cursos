const AWS = require('aws-sdk');
const { validarTokenExternamente } = require('../middlewares/authMiddleware');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME;

module.exports.handler = async (event) => {
  try {
    const token = event.headers.Authorization;
    const payload = await validarTokenExternamente(token);
    const tenant_id = payload.tenant_id;

    const curso_id = event.pathParameters.curso_id;
    const nuevos_datos = JSON.parse(event.body);

    // Verificar que el curso exista
    const resultado = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: { tenant_id, curso_id }
    }).promise();

    if (!resultado.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ mensaje: 'Curso no encontrado' })
      };
    }

    const cursoExistente = resultado.Item;

    // Actualizar datos incluyendo fecha_modificacion
    const curso_datos_actualizados = {
      ...cursoExistente.curso_datos,
      ...nuevos_datos,
      fecha_modificacion: new Date().toISOString() 
    };

    const item_actualizado = {
      tenant_id,
      curso_id,
      curso_datos: curso_datos_actualizados,
      fecha_creacion: cursoExistente.fecha_creacion //
    };

    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: item_actualizado
    }).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({ mensaje: 'Curso modificado exitosamente' })
    };

  } catch (error) {
    console.error('Error al modificar curso:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ mensaje: error.message })
    };
  }
};