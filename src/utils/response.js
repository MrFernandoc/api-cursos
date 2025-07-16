
const createResponse = (statusCode, body) => {
  return {
    statusCode: statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': false,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
};

module.exports = {
  createResponse,
};