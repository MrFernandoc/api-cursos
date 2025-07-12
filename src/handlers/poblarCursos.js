const { faker } = require('@faker-js/faker');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { validarTokenExternamente } = require('../middlewares/authMiddleware');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME;

function generarCursoFalso() {
  return {
    nombre: faker.company.catchPhrase(),
    descripcion: faker.lorem.sentence(),
    nivel: faker.helpers.arrayElement(["Básico", "Intermedio", "Avanzado"]),
    duracion_horas: faker.datatype.number({ min: 10, max: 100 }),
    precio: parseFloat(faker.commerce.price({ min: 20, max: 200 })),
    fecha_creacion: new Date().toISOString(),
    publicado: faker.datatype.boolean(),
    etiquetas: faker.helpers.arrayElements(
      ["cloud", "backend", "frontend", "python", "aws", "serverless", "nodejs", "devops"],
      faker.datatype.number({ min: 1, max: 3 })
    ),
    instructor: faker.person.fullName()
  };
}

module.exports.poblarCursos = async (event) => {
  try {
    const token = event.headers.Authorization;
    const payload = await validarTokenExternamente(token);
    const tenant_id = payload.tenant_id;

    const body = event.body ? JSON.parse(event.body) : {};
    const cantidad = body?.cantidad || 10;

    const cursosPromises = [];

    for (let i = 0; i < cantidad; i++) {
      const curso_id = uuidv4();
      const curso_datos = generarCursoFalso();

      const item = {
        tenant_id,
        curso_id,
        curso_datos
      };

      cursosPromises.push(
        dynamodb.put({
          TableName: TABLE_NAME,
          Item: item
        }).promise()
      );
    }

    await Promise.all(cursosPromises);

    return {
      statusCode: 200,
      body: JSON.stringify({ mensaje: `${cantidad} cursos insertados para el tenant ${tenant_id}.` })
    };
  } catch (error) {
    console.error('Error al poblar cursos:', error.message);
    return {
      statusCode: 401,
      body: JSON.stringify({ mensaje: error.message })
    };
  }
};
