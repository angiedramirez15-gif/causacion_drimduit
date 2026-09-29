const XLSX = require('xlsx');

const archivo = 'Centros de costos.xlsx';

const workbook = XLSX.readFile(archivo);

const nombreHoja = workbook.SheetNames[0];
const hoja = workbook.Sheets[nombreHoja];

const datos = XLSX.utils.sheet_to_json(hoja, {
    defval: ''
});

console.log('Hoja:', nombreHoja);
console.log('Cantidad de filas:', datos.length);

console.table(datos);