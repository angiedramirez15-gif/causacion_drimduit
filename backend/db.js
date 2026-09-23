require('dotenv').config();
const mariadb = require('mariadb');

const pool = mariadb.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 5
});

async function probarConexion() {
    let conexion;

    try {
        conexion = await pool.getConnection();

        console.log('Conexión a MariaDB exitosa.');
        console.log(`Base de datos: ${process.env.DB_NAME}`);

    } catch (error) {
        console.error('Error conectando a MariaDB:', error.message);

    } finally {
        if (conexion) {
            conexion.release();
        }
    }
}

probarConexion();

module.exports = pool;