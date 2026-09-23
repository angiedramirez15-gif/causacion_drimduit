const fs = require('fs');
const { XMLParser } = require('fast-xml-parser');

const rutaXML = './xml/ad0016266517008260000486c.xml';

try {
    // Leer XML exterior
    const contenidoXML = fs.readFileSync(rutaXML, 'utf8');

    const parser = new XMLParser({
        ignoreAttributes: false,
        removeNSPrefix: true
    });

    const documento = parser.parse(contenidoXML);

    // Obtener XML interno de la factura
    const xmlFactura =
        documento.AttachedDocument
            .Attachment
            .ExternalReference
            .Description;

    // Convertir XML interno en objeto
    const facturaXML = parser.parse(xmlFactura);
    const invoice = facturaXML.Invoice;

    // Proveedor
    const proveedor = invoice.AccountingSupplierParty.Party;

    const proveedorDatos = {
        nit: String(proveedor.PartyTaxScheme.CompanyID['#text']),
        razonSocial: proveedor.PartyName.Name,
        ciudad: proveedor.PhysicalLocation.Address.CityName,
        departamento: proveedor.PhysicalLocation.Address.CountrySubentity,
        direccion: proveedor.PhysicalLocation.Address.AddressLine.Line,
        correo: proveedor.Contact?.ElectronicMail || null,
        nivelTributario: proveedor.PartyTaxScheme.TaxLevelCode
    };

    // Ítems
    let lineas = invoice.InvoiceLine;

    if (!Array.isArray(lineas)) {
        lineas = [lineas];
    }

 const items = lineas.map((item) => {

    let impuesto = 0;

    if (item.TaxTotal?.TaxAmount) {
        impuesto = Number(item.TaxTotal.TaxAmount['#text']);
    }

    return {
        id: Number(item.ID['#text']),
        descripcion: item.Item.Description,
        cantidad: Number(item.InvoicedQuantity['#text']),
        unidad: item.InvoicedQuantity['@_unitCode'],
        precioUnitario: Number(item.Price.PriceAmount['#text']),
        valorLinea: Number(item.LineExtensionAmount['#text']),
        impuesto: impuesto
    };
});
    // IVA
    const taxSubtotal = invoice.TaxTotal.TaxSubtotal;

    const iva = {
        base: Number(taxSubtotal.TaxableAmount['#text']),
        porcentaje: Number(taxSubtotal.TaxCategory.Percent),
        valor: Number(taxSubtotal.TaxAmount['#text'])
    };

    // Totales
    const totales = {
        subtotal: Number(invoice.LegalMonetaryTotal.LineExtensionAmount['#text']),
        totalSinIVA: Number(invoice.LegalMonetaryTotal.TaxExclusiveAmount['#text']),
        totalConIVA: Number(invoice.LegalMonetaryTotal.TaxInclusiveAmount['#text']),
        totalPagar: Number(invoice.LegalMonetaryTotal.PayableAmount['#text'])
    };

    // Objeto final
    const factura = {
        numero: invoice.ID,
        fecha: invoice.IssueDate,
        hora: invoice.IssueTime,
        cufe: invoice.UUID['#text'],
        moneda: invoice.DocumentCurrencyCode,

        proveedor: proveedorDatos,

        items,

        impuestos: {
            iva
        },

        totales
    };

    console.log('FACTURA PROCESADA');

    console.dir(factura, {
        depth: null
    });

} catch (error) {
    console.error('Error procesando la factura:', error.message);
}