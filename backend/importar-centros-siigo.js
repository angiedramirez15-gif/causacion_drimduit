const XLSX = require('xlsx');
const pool = require('./db');

const archivo = 'Centros de costos.xlsx';

async function importarCentros() {
    let conexion;

    try {
        const workbook = XLSX.readFile(archivo);
        const hoja = workbook.Sheets['Centros de costos'];

        if (!hoja) {
            throw new Error('No se encontró la hoja "Centros de costos"');
        }

        const datos = XLSX.utils.sheet_to_json(hoja, {
            header: 1,
            defval: ''
        });

        const filas = datos.slice(4);

        const registros = filas
            .filter(fila => {
                const activo = String(fila[0]).trim();
                const codigo = String(fila[1]).trim();

                return activo === 'Si' && codigo !== '';
            })
            .map(fila => ({
                codigo: String(fila[1]).trim(),
                nombreCentro: String(fila[2]).trim(),
                nombreSubcentro: String(fila[3]).trim()
            }));

        const centrosPrincipales = registros.filter(
            r => r.nombreCentro !== ''
        );

        const subcentros = registros.filter(
            r => r.nombreSubcentro !== ''
        );

        conexion = await pool.getConnection();

        await conexion.beginTransaction();

        const idsPrincipales = new Map();

        // 1. Insertar centros principales
        for (const centro of centrosPrincipales) {

            const resultado = await conexion.query(
                `
                INSERT INTO centros_costos
                    (codigo, nombre, descripcion, estado, centro_padre_id)
                VALUES
                    (?, ?, NULL, 1, NULL)
                ON DUPLICATE KEY UPDATE
                    nombre = VALUES(nombre),
                    estado = 1
                `,
                [
                    centro.codigo,
                    centro.nombreCentro
                ]
            );

            const [fila] = await conexion.query(
                `
                SELECT id
                FROM centros_costos
                WHERE codigo = ?
                `,
                [centro.codigo]
            );

            idsPrincipales.set(centro.codigo, fila.id);
        }

        // 2. Insertar subcentros
        for (const subcentro of subcentros) {

            const codigoPadre = subcentro.codigo.split(' - ')[0];

            const padreId = idsPrincipales.get(codigoPadre);

            if (!padreId) {
                throw new Error(
                    `No se encontró el centro padre para ${subcentro.codigo}`
                );
            }

            await conexion.query(
                `
                INSERT INTO centros_costos
                    (codigo, nombre, descripcion, estado, centro_padre_id)
                VALUES
                    (?, ?, NULL, 1, ?)
                ON DUPLICATE KEY UPDATE
                    nombre = VALUES(nombre),
                    estado = 1,
                    centro_padre_id = VALUES(centro_padre_id)
                `,
                [
                    subcentro.codigo,
                    subcentro.nombreSubcentro,
                    padreId
                ]
            );
        }

        await conexion.commit();

        console.log('\n======================================');
        console.log('IMPORTACIÓN COMPLETADA');
        console.log('======================================');
        console.log(`Centros principales: ${centrosPrincipales.length}`);
        console.log(`Subcentros: ${subcentros.length}`);
        console.log(`Total importados: ${registros.length}`);
        console.log('======================================\n');

    } catch (error) {

        if (conexion) {
            await conexion.rollback();
        }

        console.error('\nERROR EN LA IMPORTACIÓN:');
        console.error(error.message);

    } finally {

        if (conexion) {
            conexion.release();
        }

        await pool.end();
    }
}

importarCentros();