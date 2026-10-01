require('dotenv').config();

const pool = require('./db');

async function buscarCentros(texto) {
    let conexion;

    try {
        conexion = await pool.getConnection();

        const sql = `
            SELECT
                id,
                codigo,
                nombre,
                descripcion,
                centro_padre_id
            FROM centros_costos
            WHERE estado = 1
              AND (
                    codigo LIKE ?
                    OR nombre LIKE ?
                    OR descripcion LIKE ?
              )
            ORDER BY codigo
            LIMIT 20
        `;

        const busqueda = `%${texto}%`;

        const centros = await conexion.query(sql, [
            busqueda,
            busqueda,
            busqueda
        ]);

        console.log(`CENTROS PARA: "${texto}"`);
        console.table(centros);

    } catch (error) {
        console.error('Error:', error.message);

    } finally {
        if (conexion) {
            conexion.release();
        }

        await pool.end();
    }
}

const texto = process.argv[2];

if (!texto) {
    console.log('Debes indicar qué quieres buscar.');
    console.log('Ejemplo: node buscar-centros.js Yerbabuena');
    process.exit(1);
}

buscarCentros(texto);