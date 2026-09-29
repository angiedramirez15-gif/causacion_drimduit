require('dotenv').config();

const pool = require('./db');

async function buscarCuentas() {
    let conexion;

    try {
        conexion = await pool.getConnection();

        const sql = `
            SELECT
                id,
                codigo,
                nombre,
                tipo,
                naturaleza
            FROM cuentas_contables
            WHERE
                nombre LIKE '%material%'
                OR nombre LIKE '%ferreter%'
                OR nombre LIKE '%mantenimiento%'
                OR nombre LIKE '%compras%'
                OR nombre LIKE '%inventario%'
                OR nombre LIKE '%element%'
                OR nombre LIKE '%herramient%'
                OR nombre LIKE '%repuesto%'
            ORDER BY codigo
        `;

        const cuentas = await conexion.query(sql);

        console.log('\n=== CUENTAS ENCONTRADAS ===\n');
        console.table(cuentas);

    } catch (error) {
        console.error('Error:', error.message);

    } finally {
        if (conexion) {
            conexion.release();
        }

        await pool.end();
    }
}

buscarCuentas();