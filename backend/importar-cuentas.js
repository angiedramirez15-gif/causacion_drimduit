const XLSX = require('xlsx');
const pool = require('./db');

const ARCHIVO = './plan_cuentas_drim_duit_clasificado.xlsx';

async function importarCuentas() {
    let conexion;

    try {
        conexion = await pool.getConnection();

        const workbook = XLSX.readFile(ARCHIVO);
        const hoja = workbook.Sheets['Sheet1'];

        if (!hoja) {
            throw new Error('No existe la hoja Sheet1.');
        }

        // Leer el Excel como matriz para encontrar los encabezados reales.
        const filas = XLSX.utils.sheet_to_json(hoja, {
            header: 1,
            defval: ''
        });

        console.log(`Filas encontradas en Excel: ${filas.length}`);

        // Buscar la fila donde aparecen Código y Nombre.
        const indiceEncabezado = filas.findIndex((fila) => {
            const texto = fila
                .map(valor => String(valor).trim().toLowerCase());

            return texto.includes('código') &&
                   texto.includes('nombre');
        });

        if (indiceEncabezado === -1) {
            throw new Error(
                'No se encontró la fila de encabezados con Código y Nombre.'
            );
        }

        console.log(
            `Encabezados encontrados en la fila: ${indiceEncabezado + 1}`
        );

        // Convertir únicamente la tabla desde los encabezados reales.
        const encabezados = filas[indiceEncabezado];

        const cuentas = filas
            .slice(indiceEncabezado + 1)
            .map((fila) => {
                const objeto = {};

                encabezados.forEach((encabezado, indice) => {
                    objeto[String(encabezado).trim()] = fila[indice];
                });

                return objeto;
            });

        console.log(`Registros de cuentas encontrados: ${cuentas.length}`);

        let nuevas = 0;
        let existentes = 0;
        let ignoradas = 0;

        for (const cuenta of cuentas) {

            const codigo = String(cuenta['Código'] ?? '').trim();
            const nombre = String(cuenta['Nombre'] ?? '').trim();

            if (!codigo || !nombre) {
                ignoradas++;
                continue;
            }

            const resultado = await conexion.query(
                `
                INSERT INTO cuentas_contables
                    (codigo, nombre, tipo, naturaleza, estado)
                VALUES
                    (?, ?, NULL, NULL, 1)
                ON DUPLICATE KEY UPDATE
                    nombre = VALUES(nombre),
                    estado = 1
                `,
                [codigo, nombre]
            );

            if (resultado.affectedRows === 1) {
                nuevas++;
            } else {
                existentes++;
            }
        }

        console.log('\n=== IMPORTACIÓN TERMINADA ===');
        console.log(`Nuevas: ${nuevas}`);
        console.log(`Existentes/actualizadas: ${existentes}`);
        console.log(`Ignoradas: ${ignoradas}`);

    } catch (error) {

        console.error(
            'Error importando cuentas:',
            error.message
        );

    } finally {

        if (conexion) {
            conexion.release();
        }

        await pool.end();
    }
}

importarCuentas();