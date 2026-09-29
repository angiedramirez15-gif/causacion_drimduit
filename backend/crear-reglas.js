require('dotenv').config();

const pool = require('./db');

async function crearRegla() {
  try {
    const palabraClave = 'PRUEBA';
    const cuentaContableId = 1;

    const sql = `
      INSERT INTO reglas_cuentas_contables
      (palabra_clave, cuenta_contable_id, prioridad, estado)
      VALUES (?, ?, ?, ?)
    `;

    const resultado = await pool.query(sql, [
      palabraClave,
      cuentaContableId,
      1,
      1
    ]);

    console.log('Regla creada correctamente');
    console.log('ID de la regla:', resultado.insertId);

  } catch (error) {
    console.error('Error creando regla:', error);
  } finally {
    await pool.end();
  }
}

crearRegla();