const axios = require('axios');

const API_USUARIOS_URL = 'https://c0fmkco8rb.execute-api.us-east-1.amazonaws.com/dev';

async function validarTokenExternamente(token) {
  if (!token) {
    throw new Error('Token requerido');
  }

  try {
    const response = await axios.get(`${API_USUARIOS_URL}/usuario/validar`, {
      headers: {
        Authorization: token
      }
    });

    // 👇 Interpretamos el string del body como JSON real
    const parsedBody = JSON.parse(response.data.body);

    if (response.status === 200 && parsedBody.payload) {
      return parsedBody.payload;
    } else {
      throw new Error('Token inválido');
    }
  } catch (error) {
    throw new Error('Token inválido o expirado');
  }
}

module.exports = {
  validarTokenExternamente
};
