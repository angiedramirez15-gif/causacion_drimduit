const XLSX = require('xlsx');
const pool = require('./db');

const archivo = 'Centros de costos.xlsx';

async function importarCentros() {
    let conexion;

    try {
        const workbook = XLSX.readFile(archivo);
        const nombreHoja = workbook.SheetNames[0];
        const hoja = workbook.Sheets[nombreHoja];

        const datos = XLSX.utils.sheet_to_json(hoja, {
            defval: ''
        });

        console.log('Hoja:', nombreHoja);
        console.log('Filas encontradas:', datos.length);

        conexion = await pool.getConnection();

        // Primero guardamos los centros principales
        const centrosPadre = new Map();

        for (const fila of datos) {
            const activo = String(fila['Activo']).trim();
            const codigo = String(fila['Código']).trim();
            const nombreCentro = String(fila['Nombre centro de costos']).trim();

            // Ignorar encabezados, información de la empresa y filas vacías
            if (!codigo || !activo) {
                continue;
            }

            // Un centro principal tiene nombre y no tiene subcentro
            if (nombreCentro && !fila['Nombre subcentro de costos']) {

                const estado = activo.toLowerCase() === 'si' ? 1 : 0;

                const resultado = await conexion.query(
                    `
                    INSERT INTO centros_costos
                    (codigo, nombre, descripcion, estado, centro_padre_id)
                    VALUES (?, ?, NULL, ?, NULL)
                    `,
                    [codigo, nombreCentro, estado]
                );

                centrosPadre.set(codigo, resultado.insertId);

                console.log(`Centro principal creado: ${codigo} - ${nombreCentro}`);
            }
        }

        // guardamos los subcentros
        for (const fila of datos) {
            const activo = String(fila['Activo']).trim();
            const codigo = String(fila['Código']).trim();
            const subcentro = String(fila['Nombre subcentro de costos']).trim();

            if (!codigo || !activo || !subcentro) {
                continue;
            }

            
            // 3 - 101 → padre 3
            const partes = codigo.split(' - ');
            const codigoPadre = partes[0];

            const padreId = centrosPadre.get(codigoPadre);

            if (!padreId) {
                console.log(`⚠️ No se encontró padre para: ${codigo}`);
                continue;
            }

            const estado = activo.toLowerCase() === 'si' ? 1 : 0;

            await conexion.query(
                `
                INSERT INTO centros_costos
                (codigo, nombre, descripcion, estado, centro_padre_id)
                VALUES (?, ?, NULL, ?, ?)
                `,
                [codigo, subcentro, estado, padreId]
            );

            console.log(`Subcentro creado: ${codigo} - ${subcentro}`);
        }

        console.log('\nImportación terminada correctamente.');

    } catch (error) {
        console.error('\nError importando centros:', error.message);

    } finally {
        if (conexion) {
            conexion.release();
        }

        await pool.end();
    }
}

importarCentros();