require('dotenv').config();

const pool = require('./db');

async function buscarCandidatas() {
  try {
    const producto = 'CINTA AISLANTE 5M BLANCA WURTH';

    const palabras = producto
      .toLowerCase()
      .split(' ')
      .filter(palabra => palabra.length >= 4);

    console.log('Producto:', producto);
    console.log('Palabras a buscar:', palabras);

    const condiciones = palabras
      .map(() => 'LOWER(nombre) LIKE ?')
      .join(' OR ');

    const valores = palabras.map(palabra => `%${palabra}%`);

    const sql = `
      SELECT
        id,
        codigo,
        nombre,
        tipo,
        naturaleza
      FROM cuentas_contables
      WHERE estado = 1
      AND (${condiciones})
      ORDER BY nombre
    `;

    const resultado = await pool.query(sql, valores);

    console.log('\n=== CUENTAS CANDIDATAS ===');
    console.table(resultado);

  } catch (error) {
    console.error('Error buscando cuentas:', error);
  } finally {
    await pool.end();
  }
}

buscarCandidatas();