const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

const verificarToken = (event) => {
  const authHeader = event.headers?.Authorization || event.headers?.authorization;

  if (!authHeader) {
    throw {
      statusCode: 401,
      message: 'Token no proporcionado',
    };
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload; // Contiene tenant_id, username, exp, etc.
  } catch (err) {
    throw {
      statusCode: 401,
      message: 'Token inválido o expirado',
    };
  }
};

module.exports = {
  verificarToken,
};
