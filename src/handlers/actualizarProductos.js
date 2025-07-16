'use strict';

const AWS = require('aws-sdk');
const axios = require('axios');

// Obtén la URL de tu Elasticsearch desde las variables de entorno
const ELASTICSEARCH_HOST = process.env.ELASTICSEARCH_HOST;
const ES_INDEX = 'cursos';

// Función principal de la Lambda
module.exports.handler = async (event) => {
  console.log('Evento de DynamoDB Stream recibido:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const eventName = record.eventName; // INSERT, MODIFY, REMOVE

    const keys = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.Keys);
    const docId = `${keys.tenant_id}_${keys.curso_id}`;

    try {
      if (eventName === 'INSERT' || eventName === 'MODIFY') {
        const newImage = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);

        console.log(`Indexando documento ID: ${docId}`);
        const url = `${ELASTICSEARCH_HOST}/${ES_INDEX}/_doc/${docId}`;
        
        const response = await axios.put(url, newImage, {
          headers: { 'Content-Type': 'application/json' },
        });

        console.log(`Documento ${docId} indexado/actualizado correctamente. Status: ${response.status}`);

      } else if (eventName === 'REMOVE') {
        console.log(`Eliminando documento ID: ${docId}`);
        const url = `${ELASTICSEARCH_HOST}/${ES_INDEX}/_doc/${docId}`;

        const response = await axios.delete(url);

        console.log(`Documento ${docId} eliminado correctamente. Status: ${response.status}`);
      }
    } catch (error) {
      console.error(`Error procesando el registro para el ID ${docId}:`, error.response ? error.response.data : error.message);
      continue;
    }
  }

  return {
    statusCode: 200,
    body: `Procesados ${event.Records.length} registros.`,
  };
};