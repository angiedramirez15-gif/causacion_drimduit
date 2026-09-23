require('dotenv').config();
const pool = require('./db');

async function revisarCuentas() {
    let conexion;

    try {
        conexion = await pool.getConnection();

        const resultado = await conexion.query(`
            SELECT *
            FROM cuentas_contables
            ORDER BY id
        `);

        console.log('CUENTAS CONTABLES');
        console.table(resultado);

    } catch (error) {
        console.error('Error:', error.message);

    } finally {
        if (conexion) {
            conexion.release();
        }

        await pool.end();
    }
}

revisarCuentas();