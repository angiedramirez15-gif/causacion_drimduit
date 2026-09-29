require('dotenv').config();

const pool = require('./db');

async function buscarReglas() {
  try {
    const sql = `
      SELECT
        r.id,
        r.palabra_clave,
        r.cuenta_contable_id,
        c.codigo,
        c.nombre,
        r.prioridad,
        r.estado
      FROM reglas_cuentas_contables r
      INNER JOIN cuentas_contables c
        ON r.cuenta_contable_id = c.id
      WHERE r.palabra_clave = ?
    `;

    const resultado = await pool.query(sql, ['PRUEBA']);

    console.table(resultado);

  } catch (error) {
    console.error('Error buscando reglas:', error);
  } finally {
    await pool.end();
  }
}

buscarReglas();