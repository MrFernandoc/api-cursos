const { faker } = require('@faker-js/faker');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { validarTokenExternamente } = require('../middlewares/authMiddleware');
const { createResponse } = require('../utils/response');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME;

function generarDatosDeCursoProgramacion(numeroCurso) {
  let nivel = "Básico";
  if (numeroCurso > 20) {
    nivel = "Avanzado";
  } else if (numeroCurso > 10) {
    nivel = "Intermedio";
  }

  return {
    nombre: `Programación ${numeroCurso}`,
    descripcion: `Curso ${nivel.toLowerCase()} de la serie de programación, enfocado en el desarrollo de software. Nivel ${numeroCurso}.`,
    nivel: nivel,
    duracion_horas: 20 + numeroCurso * 2,
    precio: parseFloat((49.99 + numeroCurso * 5).toFixed(2)),
    publicado: true,
    etiquetas: ["programación", "desarrollo", nivel.toLowerCase()],
    instructor: "Ana Coder"
  };
}

module.exports.poblarCursos = async (event) => {
  try {
    const token = event.headers.Authorization;
    const payload = await validarTokenExternamente(token);
    const tenant_id = payload.tenant_id;

    let body = {};
    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch (parseError) {
        return createResponse(400, { mensaje: 'El cuerpo de la petición contiene un JSON no válido.' });
      }
    }
    const cantidad = body.cantidad || 10;

    let numeroInicial = 1;

    const ultimoCursoParams = {
      TableName: TABLE_NAME,
      IndexName: 'CursosPorFechaIndex',
      KeyConditionExpression: 'tenant_id = :tenant',
      ExpressionAttributeValues: {
        ':tenant': tenant_id
      },
      ScanIndexForward: false,
      Limit: 1
    };
    const ultimoCursoResult = await dynamodb.query(ultimoCursoParams).promise();

    if (ultimoCursoResult.Items && ultimoCursoResult.Items.length > 0) {
      const nombreUltimoCurso = ultimoCursoResult.Items[0].curso_datos.nombre;
      const match = nombreUltimoCurso.match(/\d+$/);
      if (match) {
        const ultimoNumero = parseInt(match[0], 10);
        numeroInicial = ultimoNumero + 1;
      }
    }

    const cursosPromises = [];
    const fechaInicio = new Date();

    for (let i = 0; i < cantidad; i++) {
      const numeroCursoActual = numeroInicial + i;
      const curso_id = uuidv4();
      const curso_datos = generarDatosDeCursoProgramacion(numeroCursoActual);
      const fecha_creacion = new Date(fechaInicio.getTime() + i * 1000).toISOString();

      const item = {
        tenant_id,
        curso_id,
        curso_datos,
        fecha_creacion
      };

      cursosPromises.push(
        dynamodb.put({ TableName: TABLE_NAME, Item: item }).promise()
      );
    }

    await Promise.all(cursosPromises);

    const numeroFinal = numeroInicial + cantidad - 1;
    return createResponse(200, { 
      mensaje: `Proceso completado. Se insertaron cursos desde 'Programación ${numeroInicial}' hasta 'Programación ${numeroFinal}'.`
    });

  } catch (error) {
    console.error('Error al poblar cursos:', error.message);

    if (error.message.includes('Token')) {
      return createResponse(401, { mensaje: error.message });
    }
    
    return createResponse(500, { mensaje: 'Error interno al intentar poblar la base de datos.' });
  }
};