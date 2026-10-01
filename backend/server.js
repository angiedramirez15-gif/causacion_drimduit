const express = require('express');
const cors = require('cors');
const pool = require('./db'); 

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        mensaje: 'Backend de Causación Drim Duit funcionando correctamente',
        estado: 'OK'
    });
});
app.get('/api/facturas/:id', async (req, res) => {
    let conexion;

    try {
        const facturaId = req.params.id;

        conexion = await pool.getConnection();

        const facturas = await conexion.query(`
            SELECT
                id,
                proveedor_id,
                numero_factura,
                fecha_emision,
                fecha_vencimiento,
                subtotal,
                total_iva,
                total,
                estado
            FROM facturas
            WHERE id = ?
        `, [facturaId]);

        if (facturas.length === 0) {
            return res.status(404).json({
                mensaje: 'Factura no encontrada'
            });
        }

        const factura = facturas[0];

        const items = await conexion.query(`
            SELECT
                fi.id,
                fi.numero_item,
                fi.descripcion,
                fi.cantidad,
                fi.valor_unitario,
                fi.descuento,
                fi.subtotal,
                fi.impuesto,
                fi.total,
                fi.cuenta_contable_id,
                cc.codigo AS cuenta_codigo,
                cc.nombre AS cuenta_nombre
            FROM factura_items fi
            LEFT JOIN cuentas_contables cc
                ON cc.id = fi.cuenta_contable_id
            WHERE fi.factura_id = ?
            ORDER BY fi.numero_item
        `, [facturaId]);

        const centros = await conexion.query(`
            SELECT
                fic.id,
                fic.factura_item_id,
                fic.centro_costo_id,
                cc.codigo AS centro_codigo,
                cc.nombre AS centro_nombre,
                fic.valor
            FROM factura_item_centros_costos fic
            INNER JOIN factura_items fi
                ON fi.id = fic.factura_item_id
            INNER JOIN centros_costos cc
                ON cc.id = fic.centro_costo_id
            WHERE fi.factura_id = ?
            ORDER BY fic.id
        `, [facturaId]);

        const totalDistribuido = centros.reduce(
            (total, centro) => total + Number(centro.valor),
            0
        );

        const totalFactura = Number(factura.total);

        res.json({
            factura,
            items,
            centros,
            distribucion: {
                total_factura: totalFactura,
                total_distribuido: totalDistribuido,
                pendiente: totalFactura - totalDistribuido
            }
        });

    } catch (error) {
        console.error('Error obteniendo factura:', error);

        res.status(500).json({
            mensaje: 'Error obteniendo la factura',
            error: error.message
        });

    } finally {
        if (conexion) {
            conexion.release();
        }
    }
});
app.post('/api/facturas/:id/distribucion', async (req, res) => {
    let conexion;

    try {
        const facturaId = Number(req.params.id);
        const { distribuciones } = req.body;

        if (!Number.isInteger(facturaId)) {
            return res.status(400).json({
                mensaje: 'El ID de la factura no es válido'
            });
        }

        if (!Array.isArray(distribuciones) || distribuciones.length === 0) {
            return res.status(400).json({
                mensaje: 'Debes enviar al menos una distribución'
            });
        }

        conexion = await pool.getConnection();

        await conexion.beginTransaction();

        // 1. Verificar que la factura exista
        const facturas = await conexion.query(`
            SELECT id, total
            FROM facturas
            WHERE id = ?
            FOR UPDATE
        `, [facturaId]);

        if (facturas.length === 0) {
            await conexion.rollback();

            return res.status(404).json({
                mensaje: 'Factura no encontrada'
            });
        }

        const factura = facturas[0];
        const totalFactura = Number(factura.total);

        // 2. Obtener los items de la factura
        const items = await conexion.query(`
            SELECT
                id,
                total,
                cuenta_contable_id
            FROM factura_items
            WHERE factura_id = ?
        `, [facturaId]);

        if (items.length === 0) {
            await conexion.rollback();

            return res.status(400).json({
                mensaje: 'La factura no tiene items'
            });
        }

        const itemsMap = new Map(
            items.map(item => [
                Number(item.id),
                {
                    total: Number(item.total),
                    cuenta_contable_id: item.cuenta_contable_id
                }
            ])
        );

        // 3. Validar las distribuciones recibidas
        const distribucionPorItem = new Map();
        let totalDistribuido = 0;

        for (const distribucion of distribuciones) {

            const facturaItemId = Number(distribucion.factura_item_id);
            const cuentaContableId = Number(distribucion.cuenta_contable_id);
            const centroCostoId = Number(distribucion.centro_costo_id);
            const valor = Number(distribucion.valor);

            if (
                !Number.isInteger(facturaItemId) ||
                !Number.isInteger(cuentaContableId) ||
                !Number.isInteger(centroCostoId) ||
                !Number.isFinite(valor) ||
                valor <= 0
            ) {
                await conexion.rollback();

                return res.status(400).json({
                    mensaje: 'Una distribución contiene datos inválidos',
                    distribucion
                });
            }

            // Verificar que el item pertenece a la factura
            const item = itemsMap.get(facturaItemId);

            if (!item) {
                await conexion.rollback();

                return res.status(400).json({
                    mensaje: `El item ${facturaItemId} no pertenece a la factura ${facturaId}`
                });
            }

            // Verificar que la cuenta existe
            const cuentas = await conexion.query(`
                SELECT id
                FROM cuentas_contables
                WHERE id = ? AND estado = 1
            `, [cuentaContableId]);

            if (cuentas.length === 0) {
                await conexion.rollback();

                return res.status(400).json({
                    mensaje: `La cuenta contable ${cuentaContableId} no existe o está inactiva`
                });
            }

            // Verificar que el centro existe
            const centros = await conexion.query(`
                SELECT id
                FROM centros_costos
                WHERE id = ? AND estado = 1
            `, [centroCostoId]);

            if (centros.length === 0) {
                await conexion.rollback();

                return res.status(400).json({
                    mensaje: `El centro de costo ${centroCostoId} no existe o está inactivo`
                });
            }

            // La cuenta enviada debe coincidir con la cuenta del item
            if (
                item.cuenta_contable_id !== null &&
                Number(item.cuenta_contable_id) !== cuentaContableId
            ) {
                await conexion.rollback();

                return res.status(400).json({
                    mensaje: `La cuenta contable no coincide con la cuenta asignada al item ${facturaItemId}`
                });
            }

            if (!distribucionPorItem.has(facturaItemId)) {
                distribucionPorItem.set(facturaItemId, 0);
            }

            distribucionPorItem.set(
                facturaItemId,
                distribucionPorItem.get(facturaItemId) + valor
            );

            totalDistribuido += valor;
        }

        //  Cada item debe quedar completamente distribuido
        for (const [itemId, item] of itemsMap) {

            const distribuido = distribucionPorItem.get(itemId) || 0;

            if (Math.abs(distribuido - item.total) > 0.01) {

                await conexion.rollback();

                return res.status(400).json({
                    mensaje: `El item ${itemId} no está completamente distribuido`,
                    total_item: item.total,
                    total_distribuido: distribuido,
                    pendiente: Number((item.total - distribuido).toFixed(2))
                });
            }
        }

        // Validar el total general de la factura
        if (Math.abs(totalDistribuido - totalFactura) > 0.01) {

            await conexion.rollback();

            return res.status(400).json({
                mensaje: 'La distribución no coincide con el total de la factura',
                total_factura: totalFactura,
                total_distribuido: totalDistribuido,
                pendiente: Number((totalFactura - totalDistribuido).toFixed(2))
            });
        }

        //  Actualizar las cuentas contables de los items
        for (const distribucion of distribuciones) {

            await conexion.query(`
                UPDATE factura_items
                SET cuenta_contable_id = ?
                WHERE id = ?
                  AND factura_id = ?
            `, [
                Number(distribucion.cuenta_contable_id),
                Number(distribucion.factura_item_id),
                facturaId
            ]);
        }

        //  Eliminar distribución anterior
        await conexion.query(`
            DELETE fic
            FROM factura_item_centros_costos fic
            INNER JOIN factura_items fi
                ON fi.id = fic.factura_item_id
            WHERE fi.factura_id = ?
        `, [facturaId]);

        //  Guardar nueva distribución
        for (const distribucion of distribuciones) {

            await conexion.query(`
                INSERT INTO factura_item_centros_costos
                    (
                        factura_item_id,
                        centro_costo_id,
                        valor
                    )
                VALUES (?, ?, ?)
            `, [
                Number(distribucion.factura_item_id),
                Number(distribucion.centro_costo_id),
                Number(distribucion.valor)
            ]);
        }

        await conexion.commit();

        res.json({
            mensaje: 'Distribución guardada correctamente',
            factura_id: facturaId,
            total_factura: totalFactura,
            total_distribuido: Number(totalDistribuido.toFixed(2)),
            pendiente: 0,
            distribuciones_guardadas: distribuciones.length
        });

    } catch (error) {

        if (conexion) {
            await conexion.rollback();
        }

        console.error('Error guardando distribución:', error);

        res.status(500).json({
            mensaje: 'Error guardando la distribución',
            error: error.message
        });

    } finally {

        if (conexion) {
            conexion.release();
        }
    }
});
app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});